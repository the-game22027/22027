import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import { ID_GENERATOR, type IdGenerator } from '@shared/kernel';
import type { PointLedgerRepository, TimeWindow, UserPointsSum } from '../application/ports/point-ledger-repository';
import type { NewPointEntry, ScoredGame } from '../domain/battle-ledger-entries';

@Injectable()
export class PrismaPointLedgerRepository implements PointLedgerRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async insertNewEntries(entries: NewPointEntry[]): Promise<NewPointEntry[]> {
    if (entries.length === 0) return [];
    const inserted = await this.txHost.tx.pointEntry.createManyAndReturn({
      data: entries.map((entry) => ({ id: this.ids.next(), ...entry })),
      skipDuplicates: true,
      select: { sourceId: true },
    });
    const insertedSourceIds = new Set(inserted.map((row) => row.sourceId));
    return entries.filter((entry) => insertedSourceIds.has(entry.sourceId));
  }

  async sumPointsOfUsers(
    userIds: readonly string[],
    category: ScoredGame,
    { from, to }: TimeWindow,
  ): Promise<UserPointsSum[]> {
    if (userIds.length === 0) return [];
    const sums = await this.txHost.tx.pointEntry.groupBy({
      by: ['userId'],
      where: {
        userId: { in: [...userIds] },
        category,
        supersededAt: null,
        occurredAt: { gte: from, ...(to ? { lt: to } : {}) },
      },
      _sum: { points: true },
      _max: { occurredAt: true },
    });
    return sums.flatMap(({ userId, _sum, _max }) =>
      _max.occurredAt ? [{ userId, points: _sum.points ?? 0, lastScoredAt: _max.occurredAt }] : [],
    );
  }
}
