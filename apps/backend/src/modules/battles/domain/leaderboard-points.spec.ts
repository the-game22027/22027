import {
  type BattlePointsRuleSet,
  calculateLeaderboardPoints,
  type LeaderboardPointsRule,
  selectRuleForBattleMode,
} from './leaderboard-points';

const rule = (win: number, forfeitWinEarnsPoints = true): LeaderboardPointsRule => ({
  pointsByOutcome: { WIN: win, DRAW: 2, LOSS: 1 },
  forfeitWinEarnsPoints,
});

describe('selectRuleForBattleMode', () => {
  const ruleSet: BattlePointsRuleSet = {
    modes: { matchmakingVsHuman: rule(10), matchmakingVsBot: rule(20), room: rule(30) },
  };

  it('picks the section of the mode', () => {
    expect(selectRuleForBattleMode(ruleSet, 'MATCHMAKING', false)).toBe(ruleSet.modes.matchmakingVsHuman);
    expect(selectRuleForBattleMode(ruleSet, 'MATCHMAKING', true)).toBe(ruleSet.modes.matchmakingVsBot);
    expect(selectRuleForBattleMode(ruleSet, 'ROOM', false)).toBe(ruleSet.modes.room);
  });
});

describe('calculateLeaderboardPoints', () => {
  it('gives the points of the outcome', () => {
    expect(calculateLeaderboardPoints(rule(10), 'WIN', 'COMPLETED')).toBe(10);
    expect(calculateLeaderboardPoints(rule(10), 'DRAW', 'COMPLETED')).toBe(2);
    expect(calculateLeaderboardPoints(rule(10), 'LOSS', 'FORFEIT')).toBe(1);
  });

  it('follows forfeitWinEarnsPoints for a win by forfeit', () => {
    expect(calculateLeaderboardPoints(rule(10, true), 'WIN', 'FORFEIT')).toBe(10);
    expect(calculateLeaderboardPoints(rule(10, false), 'WIN', 'FORFEIT')).toBe(0);
    expect(calculateLeaderboardPoints(rule(10, false), 'WIN', 'COMPLETED')).toBe(10);
  });

  it('gives nothing without a rule', () => {
    expect(calculateLeaderboardPoints(null, 'WIN', 'COMPLETED')).toBe(0);
  });
});
