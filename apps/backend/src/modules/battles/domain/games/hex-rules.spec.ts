import { SeededRandom } from '../random-source';
import { isRejection } from './game-rules';
import {
  findNeighbourCells,
  findShortestPath,
  type HexConfig,
  type HexRoundState,
  HexRules,
  PHASE_TIMER,
} from './hex-rules';

const config: HexConfig = {
  pickMs: 5_000,
  answerMs: 15_000,
  lockoutMs: [3_000],
  maxPicks: 60,
  latencyGraceMs: 300,
  showWrongAnswers: true,
  points: { boardWin: 1 },
};
const T0 = new Date('2026-11-20T20:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

const rules = new HexRules(config);
type Step = ReturnType<HexRules['startRound']>;
const ok = (result: ReturnType<HexRules['handleCommand']>): Step => {
  if (isRejection(result)) throw new Error(`rejected ${result.code}`);
  return result;
};
const codeOf = (result: ReturnType<HexRules['handleCommand']>) => (isRejection(result) ? result.code : null);
const events = (step: Step) => step.effects.flatMap((effect) => (effect.type === 'EMIT' ? [effect.event] : []));
const endOf = (step: Step) => step.effects.find((effect) => effect.type === 'END_ROUND');

/** A 5×5 board; a picks first and connects west to east. */
const start = (rulesUsed = rules, clears = 1) =>
  rulesUsed.startRound({
    roundNo: 1,
    participants: ['a', 'b'],
    size: 5,
    questionsPerCell: 3,
    firstPicker: 'a',
    clearsLeft: { a: clears, b: clears },
    now: T0,
  });
const pick = (state: HexRoundState, who: string, cell: number, clear = false, ms = 500) =>
  rules.handleCommand(state, who, { type: 'HEX_PICK', cell, clear }, at(ms));
const answer = (state: HexRoundState, who: string, correct: boolean, ms = 1_000) =>
  rules.handleCommand(
    state,
    who,
    { type: 'HEX_ANSWER', answer: { entityId: correct ? 'mane' : 'modric' }, correct },
    at(ms),
  );
/** Gives `cells` to their owners directly, a's turn to pick. */
const withOwners = (owners: Record<number, string>): HexRoundState => {
  const state = start().state;
  return { ...state, owners: state.owners.map((owner, cell) => owners[cell] ?? owner) };
};

describe('HexRules', () => {
  it('starts with sides from the first picker and the pick deadline', () => {
    const step = start();
    expect(events(step)).toEqual([
      {
        type: 'ROUND_STARTED',
        roundNo: 1,
        sides: { a: 'WEST_EAST', b: 'NORTH_SOUTH' },
        firstPicker: 'a',
        pickDeadlineAt: at(5_000),
        clearsLeft: { a: 1, b: 1 },
      },
    ]);
    expect(step.effects).toContainEqual({ type: 'SCHEDULE', timer: PHASE_TIMER, at: at(5_300) });
  });

  it('only the player on turn picks an open cell; the race starts for both', () => {
    const state = start().state;
    expect(codeOf(pick(state, 'b', 12))).toBe('NOT_YOUR_PICK');
    expect(codeOf(pick(state, 'a', 25))).toBe('INVALID_CELL');
    expect(codeOf(pick(state, 'a', 12, false, 5_301))).toBe('PICK_WINDOW_CLOSED');
    const step = ok(pick(state, 'a', 12));
    expect(events(step)).toEqual([
      {
        type: 'RACE',
        roundNo: 1,
        cell: 12,
        pickedBy: 'a',
        auto: false,
        cleared: false,
        questionIndex: 0,
        answerDeadlineAt: at(15_500),
      },
    ]);
    expect(codeOf(pick(withOwners({ 12: 'b' }), 'a', 12))).toBe('CELL_TAKEN');
  });

  it('the first right answer takes the cell, and the other player picks next', () => {
    const racing = ok(pick(start().state, 'a', 12)).state;
    const step = ok(answer(racing, 'b', true));
    expect(events(step)).toEqual([
      { type: 'CLAIMED', roundNo: 1, cell: 12, participantId: 'b', entityId: 'mane' },
      { type: 'TURN', roundNo: 1, participantId: 'b', pickDeadlineAt: at(6_000) },
    ]);
    expect(step.state.owners[12]).toBe('b');
    expect(step.state.questionOf[12]).toBe(1);
  });

  it('a wrong name locks only that player out of this race', () => {
    const racing = ok(pick(start().state, 'a', 12)).state;
    const wrong = ok(answer(racing, 'a', false));
    expect(events(wrong)).toEqual([
      { type: 'ANSWERED', roundNo: 1, participantId: 'a', entityId: 'modric', lockedUntil: at(4_000) },
    ]);
    expect(codeOf(answer(wrong.state, 'a', true, 3_999))).toBe('LOCKED_OUT');
    expect(codeOf(answer(wrong.state, 'b', true, 2_000))).toBeNull();
    expect(codeOf(answer(wrong.state, 'a', true, 4_000))).toBeNull();
  });

  it('nobody right in time: the cell stays open with its next question and the turn passes', () => {
    const racing = ok(pick(start().state, 'a', 12)).state;
    const step = rules.handleTimer(racing, PHASE_TIMER, at(15_800), new SeededRandom(1));
    expect(events(step)[0]).toEqual({ type: 'EXPIRED', roundNo: 1, cell: 12 });
    expect(step.state).toMatchObject({ phase: 'PICKING', turnOf: 'b' });
    expect(step.state.owners[12]).toBeNull();
    expect(step.state.questionOf[12]).toBe(1);
  });

  it('a missed pick picks a random open cell', () => {
    const step = rules.handleTimer(start().state, PHASE_TIMER, at(5_300), new SeededRandom(7));
    expect(events(step)[0]).toMatchObject({ type: 'RACE', pickedBy: 'a', auto: true });
  });

  it('a cell that joins west to east wins the board, with the path', () => {
    // Row 2 (an even row): cells 10..14. a owns 10, 11, 13, 14 and races for 12.
    const racing = ok(pick(withOwners({ 10: 'a', 11: 'a', 13: 'a', 14: 'a' }), 'a', 12)).state;
    const step = ok(answer(racing, 'a', true));
    expect(endOf(step)).toEqual({
      type: 'END_ROUND',
      result: {
        winnerParticipantId: 'a',
        endReason: 'CONNECTED',
        points: { a: 1 },
        stepsRevealed: 1,
        carryOver: { clearsLeft: { a: 1, b: 1 } },
      },
    });
    expect(step.state.path).toEqual([10, 11, 12, 13, 14]);
  });

  it('north to south follows the offset rows', () => {
    // Column 2 straight down: 2, 7, 12, 17, 22 touch each other on this board.
    const step = ok(answer(ok(pick(withOwners({ 2: 'b', 7: 'b', 17: 'b', 22: 'b' }), 'a', 12)).state, 'b', true));
    expect(step.state.outcome).toBe('CONNECTED');
    expect(step.state.path).toEqual([2, 7, 12, 17, 22]);
  });

  it('the clear perk opens an opponent cell and races it at once, once per battle', () => {
    const state = withOwners({ 12: 'b', 6: 'a' });
    expect(codeOf(pick(state, 'a', 6, true))).toBe('CELL_NOT_OPPONENTS');
    expect(codeOf(pick(state, 'a', 3, true))).toBe('CELL_NOT_OPPONENTS');
    const step = ok(pick(state, 'a', 12, true));
    expect(events(step)[0]).toMatchObject({ type: 'RACE', cell: 12, cleared: true, questionIndex: 1 });
    expect(step.state.owners[12]).toBeNull();
    expect(step.state.clearsLeft).toEqual({ a: 0, b: 1 });
    const noneLeft = { ...state, clearsLeft: { a: 0, b: 1 } };
    expect(codeOf(pick(noneLeft, 'a', 12, true))).toBe('NO_CLEARS_LEFT');
  });

  it('ends with no winner after maxPicks', () => {
    const short = new HexRules({ ...config, maxPicks: 1 });
    const racing = ok(
      short.handleCommand(start(short).state, 'a', { type: 'HEX_PICK', cell: 0, clear: false }, at(500)),
    );
    const step = short.handleTimer(racing.state, PHASE_TIMER, at(16_000), new SeededRandom(1));
    expect(endOf(step)).toMatchObject({ result: { winnerParticipantId: null, endReason: 'MAX_TURNS' } });
    expect(step.state.outcome).toBe('MAX_PICKS');
  });

  it('a forfeit gives the board to the other player without points', () => {
    expect(endOf(rules.participantLeft(start().state, 'a'))).toMatchObject({
      result: { winnerParticipantId: 'b', endReason: 'FORFEIT', points: {} },
    });
  });
});

describe('the hex board', () => {
  it('an inner cell touches 6 others, a corner 2 or 3', () => {
    expect(findNeighbourCells(5, 12).sort((x, y) => x - y)).toEqual([6, 7, 11, 13, 16, 17]);
    expect(findNeighbourCells(5, 0).sort((x, y) => x - y)).toEqual([1, 5]);
    expect(findNeighbourCells(5, 4).sort((x, y) => x - y)).toEqual([3, 8, 9]);
  });

  it('the shortest way counts only open cells and goes around blocked ones', () => {
    const blocked = new Set([10, 11, 12, 13]);
    const path = findShortestPath(5, 'NORTH_SOUTH', (cell) => (blocked.has(cell) ? null : 1));
    expect(path).toHaveLength(5);
    expect(path).toContain(14);
    expect(findShortestPath(5, 'NORTH_SOUTH', (cell) => (cell >= 10 && cell < 15 ? null : 1))).toEqual([]);
  });
});
