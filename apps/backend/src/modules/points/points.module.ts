import { Module } from '@nestjs/common';
import { PointsQuery } from './application/points.query';
import { POINT_LEDGER_REPOSITORY } from './application/ports/point-ledger-repository';
import { SCORING_RULE_SET_REPOSITORY } from './application/ports/scoring-rule-set-repository';
import { ScoringRuleSets } from './application/scoring-rule-sets';
import { PrismaPointLedgerRepository } from './infrastructure/prisma-point-ledger.repository';
import { PrismaScoringRuleSetRepository } from './infrastructure/prisma-scoring-rule-set.repository';

/** Scoring rule sets and ledger reads for other modules (01 §2.9). The ledger handlers live in PointsJobsModule. */
@Module({
  providers: [
    ScoringRuleSets,
    PointsQuery,
    { provide: SCORING_RULE_SET_REPOSITORY, useClass: PrismaScoringRuleSetRepository },
    { provide: POINT_LEDGER_REPOSITORY, useClass: PrismaPointLedgerRepository },
  ],
  exports: [ScoringRuleSets, PointsQuery],
})
export class PointsModule {}
