import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { type RuleSetActivation, ScoringRuleSets } from '@modules/points';
import type { BattlePointsRuleSet } from '../domain/leaderboard-points';

const points = z.number().int().min(0);
const modeRule = z.strictObject({
  pointsByOutcome: z.strictObject({ WIN: points, DRAW: points, LOSS: points }),
  forfeitWinEarnsPoints: z.boolean(),
});
const battlePointsRuleSet = z.strictObject({
  modes: z.strictObject({ matchmakingVsHuman: modeRule, matchmakingVsBot: modeRule, room: modeRule }),
});

/** Checks the `config` of a BATTLE rule set (08 §6.1). Throws with every problem listed. */
export function parseBattlePointsRuleSet(config: unknown): BattlePointsRuleSet {
  const result = battlePointsRuleSet.safeParse(config);
  if (!result.success) throw new Error(`Invalid BATTLE rule set:\n${z.prettifyError(result.error)}`);
  return result.data;
}

/** Activates a BATTLE rule set after checking it (08 §6.1): battles validates, points stores and versions. */
@Injectable()
export class ActivateBattleRuleSet {
  constructor(private readonly scoringRuleSets: ScoringRuleSets) {}

  activateBattleRuleSet(name: string, config: unknown, createdBy: string): Promise<RuleSetActivation> {
    return this.scoringRuleSets.activateRuleSet('BATTLE', name, parseBattlePointsRuleSet(config), createdBy);
  }
}
