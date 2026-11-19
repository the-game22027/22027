import { isRejection } from './game-rules';
import { HINT_TIMER, type LineupConfig, type LineupRoundState, LineupRules, ROUND_TIMER } from './lineup-rules';

const config: LineupConfig = {
  roundMs: 60_000,
  lockoutMs: [2_000],
  hints: { firstAtMs: 30_000, everyMs: 0, max: 1 },
  accuse: { perPlayer: 1 },
  showWrongAnswers: true,
  latencyGraceMs: 300,
  points: { correct: 1, captain: 2, accuseRight: 3, accuseWrong: -2 },
};
const T0 = new Date('2026-11-20T20:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

const rules = new LineupRules(config);
type Step = ReturnType<LineupRules['startRound']>;
const ok = (result: ReturnType<LineupRules['handleCommand']>): Step => {
  if (isRejection(result)) throw new Error(`rejected ${result.code}`);
  return result;
};
const codeOf = (result: ReturnType<LineupRules['handleCommand']>) => (isRejection(result) ? result.code : null);
const events = (step: Step) => step.effects.flatMap((effect) => (effect.type === 'EMIT' ? [effect.event] : []));
const endOf = (step: Step) => step.effects.find((effect) => effect.type === 'END_ROUND');

/** Starters p0..p10, p0 the captain; shown names p1, p2 (real) and f (the fake, a bench player). */
const STARTERS = Array.from({ length: 11 }, (_, index) => `p${index}`);
const start = (rulesUsed = rules) =>
  rulesUsed.startRound({
    roundNo: 1,
    participants: ['a', 'b'],
    slots: STARTERS.map((playerEntityId, index) => ({ playerEntityId, captain: index === 0 })),
    shownEntityIds: ['p1', 'f', 'p2'],
    fakeEntityId: 'f',
    now: T0,
  });
const say = (state: LineupRoundState, who: string, entityId: string | null, ms = 1_000, text = 'typed') =>
  rules.handleCommand(state, who, { type: 'LINEUP_ANSWER', answer: { entityId, text } }, at(ms));

/** Places every slot not shown, alternating players, a second apart. */
const fillTheUnshownSlots = (state: LineupRoundState): Step => {
  let step: Step = { state, effects: [] };
  ['p0', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'].forEach((player, index) => {
    step = ok(say(step.state, index % 2 === 0 ? 'a' : 'b', player, 1_000 + index * 3_000));
  });
  return step;
};

describe('LineupRules', () => {
  it('starts with the round deadline and the hint time, and schedules both', () => {
    const step = start();
    expect(events(step)).toEqual([
      { type: 'ROUND_STARTED', roundNo: 1, roundDeadlineAt: at(60_000), hintsAt: at(30_000) },
    ]);
    expect(step.effects).toContainEqual({ type: 'SCHEDULE', timer: ROUND_TIMER, at: at(60_300) });
    expect(step.effects).toContainEqual({ type: 'SCHEDULE', timer: HINT_TIMER, at: at(30_000) });
  });

  it('the first right name takes the slot; the captain is worth more; a taken slot is refused without penalty', () => {
    const first = ok(say(start().state, 'a', 'p3'));
    expect(events(first)).toEqual([{ type: 'PLACED', roundNo: 1, slot: 3, entityId: 'p3', participantId: 'a' }]);
    expect(rules.findAnswerResult(first.effects, 'a')).toBe('PLACED');
    expect(codeOf(say(first.state, 'b', 'p3', 1_500))).toBe('ALREADY_TAKEN');

    const captain = ok(say(first.state, 'b', 'p0', 1_500));
    expect(captain.state.points).toEqual({ a: 1, b: 2 });
    expect(captain.effects).toContainEqual(
      expect.objectContaining({
        type: 'RECORD_ACTION',
        action: expect.objectContaining({ kind: 'LINEUP_ANSWER', isCorrect: true, points: 2 }),
      }),
    );
  });

  it('a wrong name locks only that player out; the same wrong name again costs nothing', () => {
    const wrong = ok(say(start().state, 'a', 'someone-else'));
    expect(events(wrong)).toEqual([
      { type: 'WRONG', roundNo: 1, participantId: 'a', entityId: 'someone-else', lockedUntil: at(3_000) },
    ]);
    expect(rules.findAnswerResult(wrong.effects, 'a')).toBe('WRONG');
    expect(codeOf(say(wrong.state, 'a', 'p3', 2_000))).toBe('LOCKED_OUT');
    expect(codeOf(say(wrong.state, 'b', 'p3', 2_000))).toBeNull();
    expect(codeOf(say(wrong.state, 'a', 'someone-else', 3_500))).toBe('ALREADY_TRIED');
    expect(codeOf(say(wrong.state, 'a', null, 3_500, ' Nobody '))).toBeNull();
  });

  it('hides which player a wrong name matched when wrong answers are not shown', () => {
    const quiet = new LineupRules({ ...config, showWrongAnswers: false });
    const step = quiet.handleCommand(
      start(quiet).state,
      'a',
      { type: 'LINEUP_ANSWER', answer: { entityId: 'someone-else' } },
      at(1_000),
    );
    expect(events(ok(step))).toEqual([expect.objectContaining({ type: 'WRONG', entityId: null })]);
  });

  it('unmasking the fake scores, crosses it out and puts the real shown names on the board for nobody', () => {
    const step = ok(say(start().state, 'b', 'f'));
    expect(events(step)).toEqual([
      { type: 'ACCUSED', roundNo: 1, participantId: 'b', right: true, entityId: 'f' },
      { type: 'PLACED', roundNo: 1, slot: 1, entityId: 'p1', participantId: null },
      { type: 'PLACED', roundNo: 1, slot: 2, entityId: 'p2', participantId: null },
    ]);
    expect(step.state.points).toEqual({ b: 3 });
    expect(rules.findAnswerResult(step.effects, 'b')).toBe('ACCUSED_RIGHT');
    // Once found, the fake and the real shown names are no longer accusations.
    expect(codeOf(say(step.state, 'a', 'f', 2_000))).toBe('ALREADY_TAKEN');
    expect(codeOf(say(step.state, 'a', 'p1', 2_000))).toBe('ALREADY_TAKEN');
  });

  it('a wrong accusation costs points and does not tell the opponent which shown name is real', () => {
    const step = ok(say(start().state, 'a', 'p2'));
    expect(events(step)).toEqual([{ type: 'ACCUSED', roundNo: 1, participantId: 'a', right: false, entityId: null }]);
    expect(step.state.points).toEqual({ a: -2 });
    expect(rules.findAnswerResult(step.effects, 'a')).toBe('ACCUSED_WRONG');
    expect(step.state.slots[2]?.placed).toBe(false);
    expect(codeOf(say(step.state, 'a', 'f', 2_000))).toBe('ACCUSATION_USED');
    expect(codeOf(say(step.state, 'b', 'f', 2_000))).toBeNull();
  });

  it('ends when every slot not shown is taken, the leader winning the round', () => {
    const step = fillTheUnshownSlots(start().state);
    expect(step.state.phase).toBe('CLOSED');
    expect(step.state.points).toEqual({ a: 6, b: 4 });
    expect(endOf(step)).toEqual({
      type: 'END_ROUND',
      result: { winnerParticipantId: 'a', endReason: 'LINEUP_COMPLETE', points: { a: 6, b: 4 }, stepsRevealed: 9 },
    });
  });

  it('after the fake is found the round needs all 11 slots', () => {
    const unmasked = ok(say(start().state, 'b', 'f'));
    const step = fillTheUnshownSlots(unmasked.state);
    expect(endOf(step)).toEqual(
      expect.objectContaining({ result: expect.objectContaining({ endReason: 'LINEUP_COMPLETE', stepsRevealed: 11 }) }),
    );
  });

  it('gives the first letters of the empty slots once, then ends at the deadline with a tie as no winner', () => {
    const placed = ok(say(start().state, 'a', 'p3'));
    const tied = ok(say(placed.state, 'b', 'p4', 2_000));
    const hinted = rules.handleTimer(tied.state, HINT_TIMER);
    expect(events(hinted)).toEqual([{ type: 'HINTS', roundNo: 1, slots: [0, 1, 2, 5, 6, 7, 8, 9, 10] }]);
    expect(rules.handleTimer(hinted.state, HINT_TIMER).effects).toEqual([]);

    const ended = rules.handleTimer(hinted.state, ROUND_TIMER);
    expect(endOf(ended)).toEqual({
      type: 'END_ROUND',
      result: { winnerParticipantId: null, endReason: 'TIME_UP', points: { a: 1, b: 1 }, stepsRevealed: 2 },
    });
    expect(codeOf(say(ended.state, 'a', 'p5', 59_000))).toBe('ROUND_CLOSED');
  });

  it('refuses a name after the deadline and its latency grace', () => {
    expect(codeOf(say(start().state, 'a', 'p3', 60_200))).toBeNull();
    expect(codeOf(say(start().state, 'a', 'p3', 60_400))).toBe('ROUND_CLOSED');
  });

  it('a player who leaves gives the round to the other, with the points earned so far', () => {
    const placed = ok(say(start().state, 'a', 'p3'));
    expect(endOf(rules.participantLeft(placed.state, 'a'))).toEqual({
      type: 'END_ROUND',
      result: { winnerParticipantId: 'b', endReason: 'FORFEIT', points: { a: 1 }, stepsRevealed: 1 },
    });
  });
});
