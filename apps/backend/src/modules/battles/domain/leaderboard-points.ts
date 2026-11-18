import type { Placement } from './placements';

type Outcome = Placement['outcome'];

/** How one battle mode turns an outcome into leaderboard points (08 §6.1, values DEC-33/DEC-41). */
export interface LeaderboardPointsRule {
  pointsByOutcome: Record<Outcome, number>;
  forfeitWinEarnsPoints: boolean;
}

/** The `config` of a BATTLE scoring rule set. */
export interface BattlePointsRuleSet {
  modes: {
    matchmakingVsHuman: LeaderboardPointsRule;
    matchmakingVsBot: LeaderboardPointsRule;
    room: LeaderboardPointsRule;
  };
}

export function selectRuleForBattleMode(
  ruleSet: BattlePointsRuleSet,
  mode: 'MATCHMAKING' | 'ROOM',
  hasBot: boolean,
): LeaderboardPointsRule {
  if (mode === 'ROOM') return ruleSet.modes.room;
  return hasBot ? ruleSet.modes.matchmakingVsBot : ruleSet.modes.matchmakingVsHuman;
}

/** A human's leaderboard points for one battle. Without a rule (none was active), nobody earns any. */
export function calculateLeaderboardPoints(
  rule: LeaderboardPointsRule | null,
  outcome: Outcome,
  endReason: 'COMPLETED' | 'FORFEIT',
): number {
  if (!rule) return 0;
  if (endReason === 'FORFEIT' && outcome === 'WIN' && !rule.forfeitWinEarnsPoints) return 0;
  return rule.pointsByOutcome[outcome];
}
