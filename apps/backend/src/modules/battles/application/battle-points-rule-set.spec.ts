import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseBattlePointsRuleSet } from './battle-points-rule-set';

const devFile = () =>
  JSON.parse(readFileSync(join(__dirname, '../../../../config/scoring/battle.dev.json'), 'utf8')) as {
    config: { modes: Record<string, { pointsByOutcome: Record<string, number> }> };
  };

describe('parseBattlePointsRuleSet', () => {
  it('accepts the dev rule set, where vs bot and room earn nothing (DEC-41)', () => {
    const ruleSet = parseBattlePointsRuleSet(devFile().config);
    expect(ruleSet.modes.matchmakingVsBot.pointsByOutcome).toEqual({ WIN: 0, DRAW: 0, LOSS: 0 });
    expect(ruleSet.modes.room.pointsByOutcome).toEqual({ WIN: 0, DRAW: 0, LOSS: 0 });
  });

  it('refuses negative or fractional points and missing modes', () => {
    const negative = devFile().config;
    negative.modes['matchmakingVsHuman'].pointsByOutcome['LOSS'] = -5;
    expect(() => parseBattlePointsRuleSet(negative)).toThrow('Invalid BATTLE rule set');

    const fractional = devFile().config;
    fractional.modes['room'].pointsByOutcome['WIN'] = 1.5;
    expect(() => parseBattlePointsRuleSet(fractional)).toThrow('Invalid BATTLE rule set');

    expect(() => parseBattlePointsRuleSet({ modes: {} })).toThrow('matchmakingVsHuman');
  });
});
