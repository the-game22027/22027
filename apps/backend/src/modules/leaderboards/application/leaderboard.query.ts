import { Inject, Injectable } from '@nestjs/common';
import { type PublicUser, UsersFacade } from '@modules/users';
import {
  CLOCK,
  type Clock,
  clampLimit,
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
  type PageRequest,
} from '@shared/kernel';
import type { Board } from '../domain/boards';
import { PeriodNotFoundError } from '../domain/leaderboard-errors';
import {
  findPeriodByKey,
  findPeriodContaining,
  findPeriodStatus,
  type LeaderboardCalendar,
  listRecentPeriods,
  type Period,
  type PeriodKind,
} from '../domain/period-calendar';
import {
  LEADERBOARD_CALENDAR,
  LEADERBOARD_REPOSITORY,
  type LeaderboardRepository,
  type RankedRow,
  type RowPosition,
} from './ports/leaderboard-repository';

const RECENT_PERIOD_COUNT = 12;
const NEIGHBOURS_EACH_SIDE = 2;
export const CURRENT_PERIOD_KEY = 'current';

export interface PeriodView extends Period {
  status: 'OPEN' | 'CLOSED';
}

export interface LeaderboardRowView {
  rank: number;
  user: PublicUser;
  points: number;
  isMe: boolean;
}

export interface LeaderboardPageView {
  period: PeriodView;
  board: Board;
  items: LeaderboardRowView[];
  nextCursor: string | null;
}

export interface MyRankView {
  rank: number | null;
  points: number;
  around: LeaderboardRowView[];
}

const isRowPosition = (value: Record<string, unknown>): value is Record<string, unknown> & RowPosition =>
  Number.isSafeInteger(value['points']) &&
  Number.isSafeInteger(value['tiebreak1']) &&
  Number.isSafeInteger(value['tiebreak2']) &&
  typeof value['userId'] === 'string';

/** Reads the boards (docs/api/API.md §6.8). */
@Injectable()
export class LeaderboardQuery {
  constructor(
    @Inject(LEADERBOARD_REPOSITORY) private readonly leaderboards: LeaderboardRepository,
    @Inject(LEADERBOARD_CALENDAR) private readonly calendar: LeaderboardCalendar,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly users: UsersFacade,
  ) {}

  listRecentPeriods(kind: PeriodKind): PeriodView[] {
    const now = this.clock.now();
    return listRecentPeriods(kind, now, this.calendar, RECENT_PERIOD_COUNT).map((period) => this.view(period, now));
  }

  async getPage(
    kind: PeriodKind,
    periodKey: string,
    board: Board,
    viewerId: string,
    page: Partial<PageRequest>,
  ): Promise<LeaderboardPageView> {
    const period = this.findPeriod(kind, periodKey);
    const limit = clampLimit(page.limit);
    const after = page.cursor === undefined ? null : this.positionFrom(page.cursor);
    const periodId = await this.leaderboards.findPeriodId(kind, board, period.key);
    // One extra row tells whether another page exists without a COUNT.
    const rows = periodId ? await this.leaderboards.listRowsAfter(periodId, after, limit + 1) : [];
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      period: this.view(period, this.clock.now()),
      board,
      items: await this.withUsers(items, viewerId),
      nextCursor: rows.length > limit && last ? encodeCursor({ ...this.positionOf(last) }) : null,
    };
  }

  async getMyRank(kind: PeriodKind, periodKey: string, board: Board, userId: string): Promise<MyRankView> {
    const period = this.findPeriod(kind, periodKey);
    const periodId = await this.leaderboards.findPeriodId(kind, board, period.key);
    const mine = periodId ? await this.leaderboards.findRowOfPlayer(periodId, userId) : null;
    if (!periodId || !mine) return { rank: null, points: 0, around: [] };
    const [above, below] = await Promise.all([
      this.leaderboards.listRowsBefore(periodId, mine, NEIGHBOURS_EACH_SIDE),
      this.leaderboards.listRowsAfter(periodId, mine, NEIGHBOURS_EACH_SIDE),
    ]);
    return { rank: mine.rank, points: mine.points, around: await this.withUsers([...above, mine, ...below], userId) };
  }

  private findPeriod(kind: PeriodKind, periodKey: string): Period {
    const period =
      periodKey === CURRENT_PERIOD_KEY
        ? findPeriodContaining(kind, this.clock.now(), this.calendar)
        : findPeriodByKey(kind, periodKey, this.calendar);
    if (!period) throw new PeriodNotFoundError(kind, periodKey);
    return period;
  }

  private view(period: Period, now: Date): PeriodView {
    return { ...period, status: findPeriodStatus(period, now) };
  }

  private positionOf({ points, tiebreak1, tiebreak2, userId }: RowPosition): RowPosition {
    return { points, tiebreak1, tiebreak2, userId };
  }

  private positionFrom(cursor: string): RowPosition {
    const decoded = decodeCursor(cursor);
    if (!decoded || !isRowPosition(decoded)) throw new InvalidCursorError();
    return this.positionOf(decoded);
  }

  /** Rows of players without a profile (being deleted) are left out. */
  private async withUsers(rows: RankedRow[], viewerId: string): Promise<LeaderboardRowView[]> {
    const users = new Map(
      (await this.users.findPublicUsers(rows.map((row) => row.userId))).map((user) => [user.id, user]),
    );
    return rows.flatMap((row) => {
      const user = users.get(row.userId);
      return user ? [{ rank: row.rank, user, points: row.points, isMe: row.userId === viewerId }] : [];
    });
  }
}
