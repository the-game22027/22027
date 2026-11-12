import { Module } from '@nestjs/common';
import { SCORING_RULE_SET_REPOSITORY } from './application/ports/scoring-rule-set-repository';
import { ScoringRuleSets } from './application/scoring-rule-sets';
import { PrismaScoringRuleSetRepository } from './infrastructure/prisma-scoring-rule-set.repository';

/** Scoring rule sets for the game modules (01 §2.9). The ledger handlers live in PointsJobsModule. */
@Module({
  providers: [ScoringRuleSets, { provide: SCORING_RULE_SET_REPOSITORY, useClass: PrismaScoringRuleSetRepository }],
  exports: [ScoringRuleSets],
})
export class PointsModule {}
