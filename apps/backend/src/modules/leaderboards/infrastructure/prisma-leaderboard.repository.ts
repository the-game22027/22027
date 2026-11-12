import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { UserPointsSum } from '@modules/points';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import { ID_GENERATOR, type IdGenerator } from '@shared/kernel';
import { Prisma } from '@generated/prisma/client';
import type { LeaderboardRepository, RankedRow, RowPosition } from '../application/ports/leaderboard-repository';
import type { Board } from '../domain/boards';
import type { Period, PeriodKind } from '../domain/period-calendar';

interface RankedRowRecord {
  user_id: string;
  points: bigint;
  tiebreak_1: bigint;
  tiebreak_2: bigint;
  rank: number;
}

const toRankedRow = (row: RankedRowRecord): RankedRow => ({
  userId: row.user_id,
  points: Number(row.points),
  tiebreak1: Number(row.tiebreak_1),
  tiebreak2: Number(row.tiebreak_2),
  rank: row.rank,
});

// Standard competition ranking on points only (03 §5.6): 1 + how many rows have more points.
const RANKED_COLUMNS = Prisma.sql`
  e.user_id::text AS user_id, e.points, e.tiebreak_1, e.tiebreak_2,
  (1 + (SELECT count(*) FROM leaderboard_entries ahead
        WHERE ahead.period_id = e.period_id AND ahead.points > e.points))::int AS rank`;

/** Rows after a position in board order: points DESC, tiebreak_1 DESC, tiebreak_2 DESC, user_id ASC. */
const comesAfter = ({ points, tiebreak1, tiebreak2, userId }: RowPosition) => Prisma.sql`(
  e.points < ${points}
  OR (e.points = ${points} AND e.tiebreak_1 < ${tiebreak1})
  OR (e.points = ${points} AND e.tiebreak_1 = ${tiebreak1} AND e.tiebreak_2 < ${tiebreak2})
  OR (e.points = ${points} AND e.tiebreak_1 = ${tiebreak1} AND e.tiebreak_2 = ${tiebreak2} AND e.user_id > ${userId}::uuid))`;

const comesBefore = ({ points, tiebreak1, tiebreak2, userId }: RowPosition) => Prisma.sql`(
  e.points > ${points}
  OR (e.points = ${points} AND e.tiebreak_1 > ${tiebreak1})
  OR (e.points = ${points} AND e.tiebreak_1 = ${tiebreak1} AND e.tiebreak_2 > ${tiebreak2})
  OR (e.points = ${points} AND e.tiebreak_1 = ${tiebreak1} AND e.tiebreak_2 = ${tiebreak2} AND e.user_id < ${userId}::uuid))`;

@Injectable()
export class PrismaLeaderboardRepository implements LeaderboardRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async savePeriod(period: Period, board: Board, timezone: string): Promise<string> {
    // DO UPDATE (to the same value) instead of DO NOTHING, so RETURNING gives the id of an existing row too.
    const [row] = await this.txHost.tx.$queryRaw<{ id: string }[]>`
      INSERT INTO leaderboard_periods (id, kind, category, period_key, starts_at, ends_at, timezone)
      VALUES (${this.ids.next()}::uuid, ${period.kind}::leaderboard_kind, ${board}::leaderboard_category,
              ${period.key}, ${period.startsAt}, ${period.endsAt}, ${timezone})
      ON CONFLICT (kind, category, period_key) DO UPDATE SET period_key = EXCLUDED.period_key
      RETURNING id::text`;
    return row.id;
  }

  async findPeriodId(kind: PeriodKind, board: Board, periodKey: string): Promise<string | null> {
    const period = await this.txHost.tx.leaderboardPeriod.findUnique({
      where: { kind_category_periodKey: { kind, category: board, periodKey } },
      select: { id: true },
    });
    return period?.id ?? null;
  }

  async waitForOtherUpdatesOfPlayers(board: Board, userIds: readonly string[]): Promise<void> {
    for (const userId of userIds) {
      await this.txHost.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`leaderboards:${board}:${userId}`}))`;
    }
  }

  async replacePlayerTotals(
    periodId: string,
    sums: UserPointsSum[],
    playersWithoutPoints: string[],
    at: Date,
  ): Promise<void> {
    const tx = this.txHost.tx;
    for (const { userId, points, lastScoredAt } of sums) {
      await tx.leaderboardEntry.upsert({
        where: { periodId_userId: { periodId, userId } },
        create: { periodId, userId, points, lastScoredAt, updatedAt: at },
        update: { points, lastScoredAt, updatedAt: at },
      });
    }
    if (playersWithoutPoints.length > 0) {
      await tx.leaderboardEntry.deleteMany({ where: { periodId, userId: { in: playersWithoutPoints } } });
    }
  }

  async listRowsAfter(periodId: string, after: RowPosition | null, limit: number): Promise<RankedRow[]> {
    const rows = await this.txHost.tx.$queryRaw<RankedRowRecord[]>`
      SELECT ${RANKED_COLUMNS}
      FROM leaderboard_entries e
      WHERE e.period_id = ${periodId}::uuid ${after ? Prisma.sql`AND ${comesAfter(after)}` : Prisma.empty}
      ORDER BY e.points DESC, e.tiebreak_1 DESC, e.tiebreak_2 DESC, e.user_id
      LIMIT ${limit}`;
    return rows.map(toRankedRow);
  }

  async listRowsBefore(periodId: string, before: RowPosition, limit: number): Promise<RankedRow[]> {
    const rows = await this.txHost.tx.$queryRaw<RankedRowRecord[]>`
      SELECT ${RANKED_COLUMNS}
      FROM leaderboard_entries e
      WHERE e.period_id = ${periodId}::uuid AND ${comesBefore(before)}
      ORDER BY e.points ASC, e.tiebreak_1 ASC, e.tiebreak_2 ASC, e.user_id DESC
      LIMIT ${limit}`;
    return rows.map(toRankedRow).reverse();
  }

  async findRowOfPlayer(periodId: string, userId: string): Promise<RankedRow | null> {
    const [row] = await this.txHost.tx.$queryRaw<RankedRowRecord[]>`
      SELECT ${RANKED_COLUMNS}
      FROM leaderboard_entries e
      WHERE e.period_id = ${periodId}::uuid AND e.user_id = ${userId}::uuid`;
    return row ? toRankedRow(row) : null;
  }
}
