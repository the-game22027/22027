import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { PointsQuery } from '@modules/points';
import { CLOCK, type Clock } from '@shared/kernel';
import { findBoardOfLedgerCategory, findLedgerCategoryOfBoard } from '../domain/boards';
import { type LeaderboardCalendar, listPeriodsBetween, PERIOD_KINDS } from '../domain/period-calendar';
import {
  LEADERBOARD_CALENDAR,
  LEADERBOARD_REPOSITORY,
  type LeaderboardRepository,
} from './ports/leaderboard-repository';

/** What a `PointsRecorded` event says changed in the ledger. */
export interface RecordedPoints {
  userIds: string[];
  categories: string[];
  occurredAtMin: Date;
  occurredAtMax: Date;
}

/**
 * `PointsRecorded` → board rows (03 §5.6). Each affected total is recomputed from the ledger, not
 * incremented, so a redelivered event writes the same values again.
 */
@Injectable()
export class UpdateLeaderboards {
  constructor(
    @Inject(LEADERBOARD_REPOSITORY) private readonly leaderboards: LeaderboardRepository,
    @Inject(LEADERBOARD_CALENDAR) private readonly calendar: LeaderboardCalendar,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly points: PointsQuery,
  ) {}

  @Transactional()
  async updateLeaderboardsForRecordedPoints({
    userIds,
    categories,
    occurredAtMin,
    occurredAtMax,
  }: RecordedPoints): Promise<void> {
    const players = [...new Set(userIds)].sort();
    for (const board of new Set(categories.map(findBoardOfLedgerCategory))) {
      if (!board) continue;
      await this.leaderboards.waitForOtherUpdatesOfPlayers(board, players);
      for (const kind of PERIOD_KINDS) {
        for (const period of listPeriodsBetween(kind, occurredAtMin, occurredAtMax, this.calendar)) {
          const periodId = await this.leaderboards.savePeriod(period, board, this.calendar.timezone);
          const sums = await this.points.sumPointsOfUsers(players, findLedgerCategoryOfBoard(board), {
            from: period.startsAt,
            to: period.endsAt,
          });
          const scored = new Set(sums.map((sum) => sum.userId));
          await this.leaderboards.replacePlayerTotals(
            periodId,
            sums,
            players.filter((userId) => !scored.has(userId)),
            this.clock.now(),
          );
        }
      }
    }
  }
}
