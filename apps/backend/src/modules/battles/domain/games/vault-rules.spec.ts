import { SeededRandom } from '../random-source';
import { isRejection } from './game-rules';
import { LEAK_TIMER, ROUND_TIMER, type VaultConfig, type VaultRoundState, VaultRules } from './vault-rules';

const config: VaultConfig = {
  roundMs: 120_000,
  lockoutMs: [3_000, 6_000, 9_000],
  leaks: { firstAtMs: 45_000, everyMs: 15_000, max: 3 },
  latencyGraceMs: 300,
  points: { vaultOpened: 1 },
};
const T0 = new Date('2026-11-20T20:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

const rules = new VaultRules(config);
type Step = ReturnType<VaultRules['startRound']>;
const ok = (result: ReturnType<VaultRules['handleCommand']>): Step => {
  if (isRejection(result)) throw new Error(`rejected ${result.code}`);
  return result;
};
const codeOf = (result: ReturnType<VaultRules['handleCommand']>) => (isRejection(result) ? result.code : null);
const events = (step: Step) => step.effects.flatMap((effect) => (effect.type === 'EMIT' ? [effect.event] : []));
const endOf = (step: Step) => step.effects.find((effect) => effect.type === 'END_ROUND');

/** The code 7653, for a and b. */
const start = (rulesUsed = rules) => rulesUsed.startRound(1, ['a', 'b'], [7, 6, 5, 3], T0);
const attempt = (state: VaultRoundState, who: string, code: string, ms = 1_000) =>
  rules.handleCommand(state, who, { type: 'VAULT_TRY', code }, at(ms));

describe('VaultRules', () => {
  it('starts with the digit count, the round deadline and the first leak', () => {
    const step = start();
    expect(events(step)).toEqual([
      { type: 'ROUND_STARTED', roundNo: 1, digits: 4, roundDeadlineAt: at(120_000), firstLeakAt: at(45_000) },
    ]);
    expect(step.effects).toContainEqual({ type: 'SCHEDULE', timer: ROUND_TIMER, at: at(120_300) });
    expect(step.effects).toContainEqual({ type: 'SCHEDULE', timer: LEAK_TIMER, at: at(45_000) });
  });

  it('the right code opens the vault and wins the round', () => {
    const step = ok(attempt(start().state, 'b', '7653'));
    expect(endOf(step)).toEqual({
      type: 'END_ROUND',
      result: { winnerParticipantId: 'b', endReason: 'OPENED', points: { b: 1 }, stepsRevealed: 0 },
    });
    expect(step.state.openedBy).toBe('b');
    expect(codeOf(attempt(step.state, 'a', '7653'))).toBe('ROUND_CLOSED');
  });

  it('a wrong code says nothing about which digit is wrong, shows only the try count and locks the player out', () => {
    const step = ok(attempt(start().state, 'a', '7673'));
    expect(events(step)).toEqual([{ type: 'TRIED', roundNo: 1, participantId: 'a', tries: 1 }]);
    expect(rules.lockedUntilOf(step.state, 'a', at(1_000))).toEqual(at(4_000));
    expect(codeOf(attempt(step.state, 'a', '7653', 3_999))).toBe('LOCKED_OUT');
    expect(codeOf(attempt(step.state, 'b', '7653', 2_000))).toBeNull();
    const second = ok(attempt(step.state, 'a', '7643', 4_000));
    expect(rules.lockedUntilOf(second.state, 'a', at(4_000))).toEqual(at(10_000));
  });

  it('the lockout grows 3, 6, 9 s and then stays at 9 s', () => {
    let state = start().state;
    let now = 0;
    const waits: number[] = [];
    for (let n = 0; n < 4; n += 1) {
      state = ok(attempt(state, 'a', '0000', now)).state;
      const until = rules.lockedUntilOf(state, 'a', at(now));
      waits.push((until?.getTime() ?? 0) - at(now).getTime());
      now = (until?.getTime() ?? 0) - T0.getTime();
    }
    expect(waits).toEqual([3_000, 6_000, 9_000, 9_000]);
  });

  it('refuses a code of the wrong length or with other characters', () => {
    const state = start().state;
    expect(codeOf(attempt(state, 'a', '765'))).toBe('INVALID_CODE');
    expect(codeOf(attempt(state, 'a', '76a3'))).toBe('INVALID_CODE');
    expect(codeOf(attempt(state, 'a', '76533'))).toBe('INVALID_CODE');
  });

  it('leaks a hidden digit to everyone on schedule, up to the max', () => {
    let state = start().state;
    const random = new SeededRandom(3);
    const leaked: number[] = [];
    for (const ms of [45_000, 60_000, 75_000]) {
      const step = rules.handleTimer(state, LEAK_TIMER, random);
      const [event] = events(step);
      if (event?.type !== 'LEAKED') throw new Error('expected a leak');
      expect(event.digit).toBe([7, 6, 5, 3][event.position]);
      expect(event.nextLeakAt).toEqual(ms === 75_000 ? null : at(ms + 15_000));
      leaked.push(event.position);
      state = step.state;
    }
    expect(new Set(leaked).size).toBe(3);
    expect(rules.handleTimer(state, LEAK_TIMER, random).effects).toEqual([]);
  });

  it('a round nobody opens ends with no winner at the deadline, and late tries are refused', () => {
    const state = start().state;
    expect(codeOf(attempt(state, 'a', '7653', 120_301))).toBe('ROUND_CLOSED');
    expect(endOf(rules.handleTimer(state, ROUND_TIMER, new SeededRandom(1)))).toMatchObject({
      result: { winnerParticipantId: null, endReason: 'NO_WINNER', points: {} },
    });
  });

  it('a leak that would come after the deadline is never scheduled', () => {
    const short = new VaultRules({ ...config, roundMs: 50_000 });
    const step = short.startRound(1, ['a', 'b'], [1, 2, 3, 4], T0);
    const leak = short.handleTimer(step.state, LEAK_TIMER, new SeededRandom(2));
    expect(events(leak)[0]).toMatchObject({ type: 'LEAKED', nextLeakAt: null });
  });

  it('a forfeit gives the round to the other player without points', () => {
    expect(endOf(rules.participantLeft(start().state, 'a'))).toMatchObject({
      result: { winnerParticipantId: 'b', endReason: 'FORFEIT', points: {} },
    });
  });
});
