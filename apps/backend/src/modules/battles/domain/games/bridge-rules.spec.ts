import { SeededRandom } from '../random-source';
import {
  type BridgeCommand,
  type BridgeConfig,
  type BridgeRoundState,
  BridgeRules,
  listBoardLines,
  listSquareSides,
  PHASE_TIMER,
  pickLineForBot,
} from './bridge-rules';
import { isRejection } from './game-rules';

const config: BridgeConfig = {
  pickMs: 8_000,
  answerMs: 12_000,
  wrongLine: 'GREY_GIVES_SQUARES',
  latencyGraceMs: 300,
  showWrongAnswers: true,
  points: { square: 1 },
};
const T0 = new Date('2026-11-21T20:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);
const random = () => new SeededRandom(7);
// A 3 × 3 board: lines 0–5 are horizontal, 6–11 vertical; square 0 is lines 0, 2, 6 and 7.
const CLUBS = ['real', 'barca', 'atleti', 'bayern', 'dortmund', 'leipzig', 'city', 'united', 'arsenal'];

const rules = new BridgeRules(config);
type Step = ReturnType<BridgeRules['startRound']>;
const ok = (result: ReturnType<BridgeRules['handleCommand']>): Step => {
  if (isRejection(result)) throw new Error(`rejected ${result.code}`);
  return result;
};
const codeOf = (result: ReturnType<BridgeRules['handleCommand']>) => (isRejection(result) ? result.code : null);
const events = (step: Step) => step.effects.flatMap((effect) => (effect.type === 'EMIT' ? [effect.event] : []));
const drawnEvent = (step: Step) => {
  const event = events(step).find((candidate) => candidate.type === 'DRAWN');
  if (event?.type !== 'DRAWN') throw new Error('no DRAWN event');
  return event;
};
const endOf = (step: Step) => {
  const end = step.effects.find((effect) => effect.type === 'END_ROUND');
  return end?.type === 'END_ROUND' ? end.result : null;
};

const start = (rulesUsed = rules) => rulesUsed.startRound(1, ['a', 'b'], 3, CLUBS, 'a', T0);
/** A board where `lines` are already drawn right by `by`, with `turn` to pick. */
const withDrawn = (lines: number[], turn = 'a', by = 'a'): BridgeRoundState => {
  const state = start().state;
  return {
    ...state,
    turn,
    drawn: state.drawn.map((line, index) =>
      lines.includes(index) ? { drawnBy: by, right: true, scorerEntityId: null } : line,
    ),
  };
};
const send = (state: BridgeRoundState, who: string, command: BridgeCommand, ms = 1_000, rulesUsed = rules) =>
  rulesUsed.handleCommand(state, who, command, at(ms));
const pick = (state: BridgeRoundState, line: number, who = state.turn, rulesUsed = rules) =>
  ok(send(state, who, { type: 'BRIDGE_PICK', line }, 1_000, rulesUsed)).state;
const answer = (state: BridgeRoundState, entityId: string | null, scoredAgainstBoth = true, rulesUsed = rules) =>
  ok(send(state, state.turn, { type: 'BRIDGE_ANSWER', answer: { entityId }, scoredAgainstBoth }, 2_000, rulesUsed));

describe('board geometry', () => {
  it('numbers horizontal lines row by row, then vertical ones, and finds the sides of every square', () => {
    expect(listBoardLines(4)).toHaveLength(24);
    expect(listSquareSides(4)).toHaveLength(9);
    expect(listBoardLines(3).slice(0, 2)).toEqual([
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ]);
    expect(listBoardLines(3)[6]).toEqual({ from: 0, to: 3 });
    expect(listSquareSides(3)).toEqual([
      [0, 2, 6, 7],
      [1, 3, 7, 8],
      [2, 4, 9, 10],
      [3, 5, 10, 11],
    ]);
  });
});

describe('BridgeRules', () => {
  it('starts with the first picker on turn and a pick deadline', () => {
    const step = start();
    expect(events(step)).toEqual([{ type: 'TURN', roundNo: 1, participantId: 'a', pickDeadlineAt: at(8_000) }]);
    expect(step.effects).toContainEqual({ type: 'SCHEDULE', timer: PHASE_TIMER, at: at(8_300) });
    expect(step.state.drawn.every((line) => line === null)).toBe(true);
  });

  it('asks both players about the two clubs of the picked line', () => {
    const step = ok(send(start().state, 'a', { type: 'BRIDGE_PICK', line: 6 }));
    expect(events(step)).toEqual([
      { type: 'QUESTION', roundNo: 1, line: 6, clubs: ['real', 'bayern'], auto: false, answerDeadlineAt: at(13_000) },
    ]);
    expect(step.effects).toContainEqual(
      expect.objectContaining({
        type: 'RECORD_ACTION',
        action: expect.objectContaining({ kind: 'BRIDGE_PICK', cell: 6 }),
      }),
    );
    expect(step.state).toMatchObject({ phase: 'ANSWERING', line: 6 });
  });

  it('refuses a pick out of turn, off the board, on a drawn line, late, or while answering', () => {
    const state = withDrawn([0]);
    expect(codeOf(send(state, 'b', { type: 'BRIDGE_PICK', line: 1 }))).toBe('NOT_YOUR_TURN');
    for (const line of [12, -1, 1.5])
      expect(codeOf(send(state, 'a', { type: 'BRIDGE_PICK', line }))).toBe('INVALID_LINE');
    expect(codeOf(send(state, 'a', { type: 'BRIDGE_PICK', line: 0 }))).toBe('LINE_TAKEN');
    expect(codeOf(send(state, 'a', { type: 'BRIDGE_PICK', line: 1 }, 8_301))).toBe('PICK_WINDOW_CLOSED');
    expect(codeOf(send(pick(state, 1), 'a', { type: 'BRIDGE_PICK', line: 2 }))).toBe('NOT_YOUR_TURN');
  });

  it('refuses an answer from the other player or after the answer window', () => {
    const state = pick(start().state, 0);
    const text = { type: 'BRIDGE_ANSWER', answer: { entityId: 'benzema' }, scoredAgainstBoth: true } as const;
    expect(codeOf(send(state, 'b', text))).toBe('NOT_YOUR_TURN');
    expect(codeOf(send(state, 'a', text, 13_301))).toBe('ANSWER_WINDOW_CLOSED');
  });

  it('draws a right line in the player’s name and passes the turn when it closes nothing', () => {
    const step = answer(pick(start().state, 0), 'benzema');
    expect(drawnEvent(step)).toMatchObject({
      line: 0,
      participantId: 'a',
      result: 'RIGHT',
      scorerEntityId: 'benzema',
      closed: [],
    });
    expect(step.state.drawn[0]).toEqual({ drawnBy: 'a', right: true, scorerEntityId: 'benzema' });
    expect(step.state).toMatchObject({ turn: 'b', phase: 'PICKING', used: ['benzema'] });
  });

  it('gives the square to a right line that closes it, and the same player picks again', () => {
    const step = answer(pick(withDrawn([0, 2, 6], 'a', 'b'), 7), 'lewandowski');
    expect(drawnEvent(step)).toMatchObject({ closed: [{ square: 0, ownerId: 'a' }], points: { a: 1 } });
    expect(step.state).toMatchObject({ turn: 'a', squares: ['a', null, null, null] });
  });

  it('draws a wrong line grey, gives the squares it closes to the opponent, and passes the turn', () => {
    const step = answer(pick(withDrawn([0, 2, 6]), 7), 'messi', false);
    expect(drawnEvent(step)).toMatchObject({
      result: 'WRONG',
      scorerEntityId: null,
      entityId: 'messi',
      closed: [{ square: 0, ownerId: 'b' }],
      points: { b: 1 },
    });
    expect(step.state.drawn[7]).toEqual({ drawnBy: 'a', right: false, scorerEntityId: null });
    expect(step.state).toMatchObject({ turn: 'b', used: [] });
  });

  it('closes the square for nobody when a wrong line gives nothing (DEC-85 option)', () => {
    const giving = new BridgeRules({ ...config, wrongLine: 'GREY_GIVES_NOTHING' });
    const state = pick(withDrawn([0, 2, 6]), 7, 'a', giving);
    const step = answer(state, null, false, giving);
    expect(drawnEvent(step)).toMatchObject({ closed: [{ square: 0, ownerId: null }], points: {} });
  });

  it('counts a scorer already used on the board as a miss and shows who it was', () => {
    const first = answer(pick(start().state, 0), 'benzema');
    const step = answer(pick(first.state, 1), 'benzema');
    expect(drawnEvent(step)).toMatchObject({ result: 'USED', entityId: 'benzema', scorerEntityId: null });
    expect(step.state.drawn[1]).toMatchObject({ right: false });
    expect(step.state.turn).toBe('a');
  });

  it('hides what a wrong text matched when wrong answers are not shown', () => {
    const hiding = new BridgeRules({ ...config, showWrongAnswers: false });
    const step = answer(pick(start().state, 0, 'a', hiding), 'messi', false, hiding);
    expect(drawnEvent(step).entityId).toBeNull();
  });

  it('picks a random open line at the pick deadline, and draws grey at the answer deadline', () => {
    const picked = rules.handleTimer(withDrawn([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), PHASE_TIMER, at(8_300), random());
    expect(events(picked)).toEqual([expect.objectContaining({ type: 'QUESTION', line: 11, auto: true })]);
    const timedOut = rules.handleTimer(pick(start().state, 0), PHASE_TIMER, at(13_300), random());
    expect(drawnEvent(timedOut)).toMatchObject({ result: 'TIME_UP', line: 0 });
    expect(timedOut.effects).toContainEqual(
      expect.objectContaining({ action: expect.objectContaining({ kind: 'BRIDGE_ANSWER', isCorrect: false }) }),
    );
    expect(timedOut.state.turn).toBe('b');
  });

  it('ends when the last line is drawn: most squares wins, equal squares is a draw', () => {
    // a owns squares 0 and 1, b owns square 2; the last line (11) closes square 3.
    const almost = (owners: (string | null)[]) => ({
      ...withDrawn([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
      squares: owners,
    });
    const tied = answer(pick(almost(['a', 'a', 'b', null]), 11), 'kane', false);
    expect(endOf(tied)).toMatchObject({ winnerParticipantId: null, endReason: 'BOARD_COMPLETE', stepsRevealed: 12 });
    const ahead = answer(pick(almost(['a', 'a', 'b', null]), 11), 'kane');
    expect(endOf(ahead)).toMatchObject({ winnerParticipantId: 'a', endReason: 'BOARD_COMPLETE' });
    expect(ahead.state.phase).toBe('CLOSED');
  });

  it('gives the board to the one who stays when the other leaves', () => {
    const step = rules.participantLeft(start().state, 'a');
    expect(endOf(step)).toMatchObject({ winnerParticipantId: 'b', endReason: 'FORFEIT' });
  });
});

describe('pickLineForBot', () => {
  it('takes a line that closes a square', () => {
    expect(pickLineForBot(withDrawn([0, 2, 6]), random())).toBe(7);
  });

  it('prefers a line that closes two squares over one that closes one', () => {
    // Line 7 is the shared side of squares 0 and 1, both on three sides; line 4 alone would close square 2.
    const state = withDrawn([0, 2, 6, 1, 3, 8, 9, 10]);
    for (let seed = 1; seed <= 20; seed++) expect(pickLineForBot(state, new SeededRandom(seed))).toBe(7);
  });

  it('avoids a third side of a square when it can', () => {
    // Square 0 has two sides; lines 2 or 7 would give it away, every other line is safe.
    const line = pickLineForBot(withDrawn([0, 6]), random());
    expect([2, 7]).not.toContain(line);
  });

  it('gives away the fewest squares when every line gives some', () => {
    // Every square has two sides except that line 10 (shared by squares 2 and 3) would give both away.
    const state = withDrawn([0, 6, 1, 8, 4, 9, 5, 11]);
    expect([2, 3, 7]).toContain(pickLineForBot(state, random()));
  });
});
