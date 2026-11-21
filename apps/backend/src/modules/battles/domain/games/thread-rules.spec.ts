import { isRejection } from './game-rules';
import {
  hintTimerOf,
  ROUND_TIMER,
  type ThreadCommand,
  type ThreadConfig,
  type ThreadRoundState,
  ThreadRules,
} from './thread-rules';

const config: ThreadConfig = {
  roundMs: 150_000,
  lockoutMs: [3_000, 6_000, 9_000],
  hint: { afterMs: 20_000 },
  jump: { perThread: 1 },
  timeUp: 'HIGHER_ROOM_WINS',
  latencyGraceMs: 300,
  points: { thread: 1 },
};
const T0 = new Date('2026-11-21T20:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

const rules = new ThreadRules(config);
type Step = ReturnType<ThreadRules['startRound']>;
const ok = (result: ReturnType<ThreadRules['handleCommand']>): Step => {
  if (isRejection(result)) throw new Error(`rejected ${result.code}`);
  return result;
};
const codeOf = (result: ReturnType<ThreadRules['handleCommand']>) => (isRejection(result) ? result.code : null);
const events = (step: Step) => step.effects.flatMap((effect) => (effect.type === 'EMIT' ? [effect.event] : []));
const endOf = (step: Step) => {
  const end = step.effects.find((effect) => effect.type === 'END_ROUND');
  return end?.type === 'END_ROUND' ? end.result : null;
};

const start = (rulesUsed = rules) => rulesUsed.startRound(1, ['a', 'b'], 5, T0).state;
const send = (state: ThreadRoundState, who: string, command: ThreadCommand, ms = 1_000, rulesUsed = rules) =>
  rulesUsed.handleCommand(state, who, command, at(ms));
const answer = (state: ThreadRoundState, who: string, right: boolean, ms = 1_000, rulesUsed = rules) =>
  send(
    state,
    who,
    { type: 'THREAD_ANSWER', room: state.progress[who].room, answer: { entityId: 'x' }, right },
    ms,
    rulesUsed,
  );
/** `who` answers right `times` times in a row. */
const advance = (state: ThreadRoundState, who: string, times: number): ThreadRoundState => {
  let current = state;
  for (let index = 0; index < times; index += 1) current = ok(answer(current, who, true)).state;
  return current;
};

describe('ThreadRules', () => {
  it('starts both players in room 0 with a round deadline and a hint timer each', () => {
    const step = rules.startRound(1, ['a', 'b'], 5, T0);
    expect(step.state.progress['a']).toMatchObject({ room: 0, jumpsLeft: 1, jumping: false, hinted: false });
    expect(step.effects).toEqual([
      { type: 'SCHEDULE', timer: ROUND_TIMER, at: at(150_300) },
      { type: 'SCHEDULE', timer: hintTimerOf('a'), at: at(20_000) },
      { type: 'SCHEDULE', timer: hintTimerOf('b'), at: at(20_000) },
    ]);
  });

  it('moves a right answer to the next room and restarts that player’s hint clock', () => {
    const step = ok(answer(start(), 'a', true, 5_000));
    expect(events(step)).toEqual([{ type: 'PROGRESSED', roundNo: 1, participantId: 'a', room: 1, jumped: false }]);
    expect(step.effects).toContainEqual({ type: 'SCHEDULE', timer: hintTimerOf('a'), at: at(25_000) });
    expect(step.state.progress['b'].room).toBe(0);
  });

  it('locks out a wrong answer on the ladder and keeps the player in the room', () => {
    const first = ok(answer(start(), 'a', false, 1_000));
    expect(events(first)).toEqual([
      { type: 'LOCKED', roundNo: 1, participantId: 'a', lockedUntil: at(4_000), entityId: 'x' },
    ]);
    expect(first.state.progress['a'].room).toBe(0);
    expect(codeOf(answer(first.state, 'a', true, 3_999))).toBe('LOCKED_OUT');
    const second = ok(answer(first.state, 'a', false, 4_000));
    expect(rules.lockedUntilOf(second.state, 'a', at(4_000))).toEqual(at(10_000));
  });

  it('refuses an answer to another room, after the deadline, or from someone who left', () => {
    const state = start();
    expect(codeOf(send(state, 'a', { type: 'THREAD_ANSWER', room: 1, answer: { entityId: 'x' }, right: true }))).toBe(
      'NOT_YOUR_ROOM',
    );
    expect(codeOf(answer(state, 'a', true, 150_301))).toBe('ROUND_CLOSED');
    expect(codeOf(send(state, 'c', { type: 'THREAD_ANSWER', room: 0, answer: { entityId: 'x' }, right: true }))).toBe(
      'PARTICIPANT_FORFEITED',
    );
  });

  it('wins the thread for the first player to answer the last room', () => {
    const almost = advance(start(), 'a', 4);
    const step = ok(answer(almost, 'a', true));
    expect(events(step)).toContainEqual(expect.objectContaining({ type: 'PROGRESSED', room: 5 }));
    expect(endOf(step)).toMatchObject({ winnerParticipantId: 'a', endReason: 'THREAD_COMPLETE', points: { a: 1 } });
    expect(step.state.phase).toBe('CLOSED');
  });

  it('a right jump skips two rooms; the target is the next room’s answer while jumping', () => {
    const jumped = ok(send(start(), 'a', { type: 'THREAD_JUMP', room: 0 }));
    expect(events(jumped)).toEqual([{ type: 'JUMPED', roundNo: 1, participantId: 'a', room: 0 }]);
    expect(rules.targetSlotOf(jumped.state, 'a')).toBe(1);
    const step = ok(answer(jumped.state, 'a', true));
    expect(events(step)).toEqual([{ type: 'PROGRESSED', roundNo: 1, participantId: 'a', room: 2, jumped: true }]);
    expect(step.state.progress['a']).toMatchObject({ room: 2, jumpsLeft: 0, jumping: false });
    expect(codeOf(send(step.state, 'a', { type: 'THREAD_JUMP', room: 2 }))).toBe('NO_JUMP_LEFT');
  });

  it('a wrong jump answer spends the jump, locks out and goes back to the room’s own question', () => {
    const jumped = ok(send(start(), 'a', { type: 'THREAD_JUMP', room: 0 })).state;
    const step = ok(answer(jumped, 'a', false));
    expect(step.state.progress['a']).toMatchObject({ room: 0, jumping: false, jumpsLeft: 0 });
    expect(rules.targetSlotOf(step.state, 'a')).toBe(0);
    expect(events(step)).toEqual([expect.objectContaining({ type: 'LOCKED' })]);
  });

  it('refuses a jump in the last room or while already jumping', () => {
    expect(codeOf(send(advance(start(), 'a', 4), 'a', { type: 'THREAD_JUMP', room: 4 }))).toBe('JUMP_NOT_ALLOWED');
    const jumping = ok(send(start(), 'a', { type: 'THREAD_JUMP', room: 0 })).state;
    expect(codeOf(send(jumping, 'a', { type: 'THREAD_JUMP', room: 0 }))).toBe('JUMP_NOT_ALLOWED');
  });

  it('gives one hint per room, for the next room’s answer while jumping', () => {
    const hinted = rules.handleTimer(start(), hintTimerOf('a'));
    expect(events(hinted)).toEqual([{ type: 'HINTED', roundNo: 1, participantId: 'a', room: 0, slot: 0 }]);
    expect(events(rules.handleTimer(hinted.state, hintTimerOf('a')))).toEqual([]);
    const jumping = ok(send(start(), 'a', { type: 'THREAD_JUMP', room: 0 })).state;
    expect(events(rules.handleTimer(jumping, hintTimerOf('a')))).toEqual([
      { type: 'HINTED', roundNo: 1, participantId: 'a', room: 0, slot: 1 },
    ]);
  });

  it('a jump is a new question: its hint clock starts at the jump, not at the room', () => {
    const jumped = ok(send(start(), 'a', { type: 'THREAD_JUMP', room: 0 }, 15_000));
    expect(jumped.effects).toEqual(
      expect.arrayContaining([
        { type: 'CANCEL', timer: hintTimerOf('a') },
        { type: 'SCHEDULE', timer: hintTimerOf('a'), at: at(35_000) },
      ]),
    );
    expect(rules.hintOf(jumped.state, 'a')).toEqual({ hinted: false, hintAt: at(35_000) });
  });

  it('a room hint already out does not carry over to the jump question, and comes back after a wrong jump', () => {
    const hinted = rules.handleTimer(start(), hintTimerOf('a')).state;
    expect(rules.hintOf(hinted, 'a')).toEqual({ hinted: true, hintAt: null });
    const jumped = ok(send(hinted, 'a', { type: 'THREAD_JUMP', room: 0 }, 25_000)).state;
    expect(rules.hintOf(jumped, 'a')).toEqual({ hinted: false, hintAt: at(45_000) });
    const jumpHint = rules.handleTimer(jumped, hintTimerOf('a'));
    expect(events(jumpHint)).toEqual([{ type: 'HINTED', roundNo: 1, participantId: 'a', room: 0, slot: 1 }]);
    const back = ok(answer(jumpHint.state, 'a', false, 50_000));
    expect(rules.hintOf(back.state, 'a')).toEqual({ hinted: true, hintAt: null });
    expect(rules.targetSlotOf(back.state, 'a')).toBe(0);
    expect(back.effects).not.toContainEqual(expect.objectContaining({ type: 'SCHEDULE' }));
  });

  it('a wrong jump before the room hint brings the room hint back on its own clock, at once if it passed', () => {
    const jumped = ok(send(start(), 'a', { type: 'THREAD_JUMP', room: 0 }, 15_000)).state;
    const back = ok(answer(jumped, 'a', false, 30_000));
    expect(back.effects).toContainEqual({ type: 'SCHEDULE', timer: hintTimerOf('a'), at: at(30_000) });
    expect(events(rules.handleTimer(back.state, hintTimerOf('a')))).toEqual([
      { type: 'HINTED', roundNo: 1, participantId: 'a', room: 0, slot: 0 },
    ]);
    const early = ok(answer(ok(send(start(), 'a', { type: 'THREAD_JUMP', room: 0 }, 5_000)).state, 'a', false, 8_000));
    expect(early.effects).toContainEqual({ type: 'SCHEDULE', timer: hintTimerOf('a'), at: at(20_000) });
  });

  it('at the deadline the player further along wins, and the same room is a draw', () => {
    const ahead = advance(advance(start(), 'a', 3), 'b', 1);
    expect(endOf(rules.handleTimer(ahead, ROUND_TIMER))).toMatchObject({
      winnerParticipantId: 'a',
      endReason: 'TIME_UP',
      points: { a: 1 },
      stepsRevealed: 3,
    });
    const level = advance(advance(start(), 'a', 2), 'b', 2);
    expect(endOf(rules.handleTimer(level, ROUND_TIMER))).toMatchObject({ winnerParticipantId: null, points: {} });
  });

  it('makes time up a draw for everyone when configured so (DEC-86 option)', () => {
    const drawing = new ThreadRules({ ...config, timeUp: 'DRAW' });
    const ahead = advance(drawing.startRound(1, ['a', 'b'], 5, T0).state, 'a', 3);
    expect(endOf(drawing.handleTimer(ahead, ROUND_TIMER))).toMatchObject({ winnerParticipantId: null });
  });

  it('gives the thread to the one who stays when the other leaves, without points', () => {
    const step = rules.participantLeft(advance(start(), 'a', 2), 'a');
    expect(endOf(step)).toMatchObject({ winnerParticipantId: 'b', endReason: 'FORFEIT', points: {} });
  });
});
