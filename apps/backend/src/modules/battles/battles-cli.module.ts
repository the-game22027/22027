import { Module } from '@nestjs/common';
import { PointsModule } from '@modules/points';
import { ActivateBattleRuleSet } from './application/battle-points-rule-set';
import { BattlesActivateRuleSetCommand } from './presentation/cli/battles-activate-rule-set.command';

/** Battle operations run from the CLI. */
@Module({
  imports: [PointsModule],
  providers: [ActivateBattleRuleSet, BattlesActivateRuleSetCommand],
  exports: [ActivateBattleRuleSet],
})
export class BattlesCliModule {}
