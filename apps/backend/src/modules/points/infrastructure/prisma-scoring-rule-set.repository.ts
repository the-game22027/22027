import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import type { Prisma } from '@generated/prisma/client';
import type {
  ActiveRuleSet,
  NewActiveRuleSet,
  ScoringRuleSetRepository,
} from '../application/ports/scoring-rule-set-repository';
import type { ScoredGame } from '../domain/battle-ledger-entries';

@Injectable()
export class PrismaScoringRuleSetRepository implements ScoringRuleSetRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {}

  async findActiveRuleSet(game: ScoredGame): Promise<ActiveRuleSet | null> {
    const row = await this.txHost.tx.scoringRuleSet.findFirst({ where: { gameType: game, status: 'ACTIVE' } });
    return row && { id: row.id, game: row.gameType, version: row.version, name: row.name, config: row.config };
  }

  async waitForOtherActivations(game: ScoredGame): Promise<void> {
    await this.txHost.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`points:activate:${game}`}))`;
  }

  async findHighestVersion(game: ScoredGame): Promise<number> {
    const { _max } = await this.txHost.tx.scoringRuleSet.aggregate({
      where: { gameType: game },
      _max: { version: true },
    });
    return _max.version ?? 0;
  }

  async retireActiveRuleSet(game: ScoredGame): Promise<void> {
    await this.txHost.tx.scoringRuleSet.updateMany({
      where: { gameType: game, status: 'ACTIVE' },
      data: { status: 'RETIRED' },
    });
  }

  async insertActiveRuleSet(ruleSet: NewActiveRuleSet): Promise<void> {
    await this.txHost.tx.scoringRuleSet.create({
      data: {
        id: ruleSet.id,
        gameType: ruleSet.game,
        version: ruleSet.version,
        name: ruleSet.name,
        config: ruleSet.config as Prisma.InputJsonValue,
        status: 'ACTIVE',
        effectiveFrom: ruleSet.activatedAt,
        createdAt: ruleSet.activatedAt,
        createdBy: ruleSet.createdBy,
      },
    });
  }
}
