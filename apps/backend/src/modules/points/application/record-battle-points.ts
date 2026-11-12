import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { OutboxWriter } from '@shared/infrastructure/outbox';
import { type CompletedBattle, listLedgerEntriesOfBattle } from '../domain/battle-ledger-entries';
import { POINT_LEDGER_REPOSITORY, type PointLedgerRepository } from './ports/point-ledger-repository';

/**
 * `BattleCompleted` → ledger (05 §2 "Record points"). Idempotent: a redelivered event inserts nothing
 * and publishes nothing, because the entries' source key is unique.
 */
@Injectable()
export class RecordBattlePoints {
  constructor(
    @Inject(POINT_LEDGER_REPOSITORY) private readonly ledger: PointLedgerRepository,
    private readonly outbox: OutboxWriter,
  ) {}

  /** Returns how many entries were new. */
  @Transactional()
  async recordPointsOfBattle(battle: CompletedBattle): Promise<number> {
    const inserted = await this.ledger.insertNewEntries(listLedgerEntriesOfBattle(battle));
    if (inserted.length === 0) return 0;
    await this.outbox.write({
      type: 'PointsRecorded',
      version: 1,
      aggregateType: 'battle',
      aggregateId: battle.battleId,
      occurredAt: battle.endedAt,
      payload: {
        userIds: [...new Set(inserted.map((entry) => entry.userId))],
        categories: ['BATTLE'],
        occurredAtMin: battle.endedAt.toISOString(),
        occurredAtMax: battle.endedAt.toISOString(),
      },
    });
    return inserted.length;
  }
}
