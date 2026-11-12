import { isRejection, type RulesStep } from './game-rules';
import { type GridConfig, type GridEvent, GridRules, type GridRoundState, TURN_TIMER } from './grid-rules';

const config: GridConfig = {
  turnMs: 10_000,
  attemptsPerTurn: 1,
  skipsPerRound: null,
  maxTurns: 20,
  latencyGraceMs: 300,
  showWrongAnswers: true,
  points: { roundWin: 10, roundDraw: 3, perCell: 1 },
};
const T0 = new Date('2026-11-12T20:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);
type Step = RulesStep<GridRoundState, GridEvent>;

const ok = (result: Step | ReturnType<GridRules['handleCommand']>): Step => {
  if (isRejection(result)) throw new Error(`rejected ${result.code}`);
  return result;
};
const events = (step: Step) => step.effects.flatMap((effect) => (effect.type === 'EMIT' ? [effect.event] : []));
const endOf = (step: Step) => step.effects.find((effect) => effect.type === 'END_ROUND');

describe('GridRules', () => {
  const rules = new GridRules(config);
  const start = (rulesUsed = rules) => rulesUsed.startRound(1, ['a', 'b'], 'a', T0);
  const claim = (
    state: GridRoundState,
    who: string,
    cell: number,
    entityId: string,
    verdict: 'CORRECT' | 'WRONG' = 'CORRECT',
    ms = 100,
  ) => ok(rules.handleCommand(state, who, { type: 'GRID_CLAIM', cell, answer: { entityId }, verdict }, at(ms)));

  it('starts with the first turn and its timer (deadline plus grace)', () => {
    const step = start();
    expect(events(step)).toEqual([
      { type: 'ROUND_STARTED', roundNo: 1, firstTurn: 'a' },
      { type: 'TURN', roundNo: 1, participantId: 'a', turnDeadlineAt: at(10_000), attemptsLeft: 1 },
    ]);
    expect(step.effects).toContainEqual({ type: 'SCHEDULE', timer: TURN_TIMER, at: at(10_300) });
  });

  it('takes the cell on a correct claim and passes the turn', () => {
    const step = claim(start().state, 'a', 4, 'zidane');
    expect(step.state.board[4]).toBe('a');
    expect(step.state.usedPlayers).toEqual(['zidane']);
    expect(events(step).map((event) => event.type)).toEqual(['CLAIMED', 'TURN']);
    expect(step.state.turnOf).toBe('b');
  });

  it('refuses the wrong player, a taken cell, and a player already used on the board', () => {
    const after = claim(start().state, 'a', 4, 'zidane').state;
    const tryClaim = (who: string, cell: number, entityId: string, ms = 200) =>
      rules.handleCommand(after, who, { type: 'GRID_CLAIM', cell, answer: { entityId }, verdict: 'CORRECT' }, at(ms));
    expect(tryClaim('a', 0, 'x')).toEqual({ rejected: true, code: 'NOT_YOUR_TURN' });
    expect(tryClaim('b', 4, 'x')).toEqual({ rejected: true, code: 'CELL_TAKEN' });
    expect(tryClaim('b', 0, 'zidane')).toEqual({ rejected: true, code: 'PLAYER_ALREADY_USED' });
    expect(tryClaim('b', 0, 'x', 10_401)).toEqual({ rejected: true, code: 'TURN_CLOSED' });
  });

  it('wins the round with three in a line', () => {
    let state = start().state;
    state = claim(state, 'a', 0, 'p1').state;
    state = claim(state, 'b', 3, 'p2').state;
    state = claim(state, 'a', 1, 'p3').state;
    state = claim(state, 'b', 4, 'p4').state;
    const won = claim(state, 'a', 2, 'p5');
    expect(endOf(won)).toEqual({
      type: 'END_ROUND',
      result: { winnerParticipantId: 'a', endReason: 'GRID_LINE', points: { a: 13, b: 2 }, stepsRevealed: 5 },
    });
    expect(won.state.line).toEqual([0, 1, 2]);
  });

  it('is a draw when the board fills without a line', () => {
    // a b a / a b b / b a a : no line
    const order: [string, number][] = [
      ['a', 0],
      ['b', 1],
      ['a', 2],
      ['b', 4],
      ['a', 3],
      ['b', 5],
      ['a', 7],
      ['b', 6],
      ['a', 8],
    ];
    let step = start();
    order.forEach(([who, cell], index) => {
      step = claim(step.state, who, cell, `p${String(index)}`);
    });
    expect(endOf(step)).toMatchObject({ result: { endReason: 'GRID_FULL', winnerParticipantId: null } });
  });

  it('keeps the turn after a wrong answer while attempts are left, then passes it', () => {
    const twice = new GridRules({ ...config, attemptsPerTurn: 2 });
    const first = ok(
      twice.handleCommand(
        start(twice).state,
        'a',
        { type: 'GRID_CLAIM', cell: 0, answer: { entityId: 'x' }, verdict: 'WRONG' },
        at(10),
      ),
    );
    expect(first.state).toMatchObject({ turnOf: 'a', attemptsLeft: 1, board: Array(9).fill(null), usedPlayers: [] });
    const second = ok(
      twice.handleCommand(
        first.state,
        'a',
        { type: 'GRID_CLAIM', cell: 0, answer: { entityId: null, text: 'nobody', match: 'NONE' }, verdict: 'WRONG' },
        at(20),
      ),
    );
    expect(second.state.turnOf).toBe('b');
  });

  it('records the typed text of a miss, and shows no player when the text named nobody (ADR-0021)', () => {
    const answer = { entityId: null, text: 'nobody', match: 'NONE' as const };
    const step = ok(
      rules.handleCommand(start().state, 'a', { type: 'GRID_CLAIM', cell: 0, answer, verdict: 'WRONG' }, at(10)),
    );
    expect(step.effects).toContainEqual({
      type: 'RECORD_ACTION',
      action: expect.objectContaining({ answer, isCorrect: false }) as unknown,
    });
    expect(events(step)[0]).toMatchObject({ type: 'MISSED', entityId: null });
  });

  it('passes the turn on a timeout or a skip, and a skip beyond the limit gives the round away', () => {
    const timedOut = rules.handleTimer(start().state, TURN_TIMER, at(10_300));
    expect(events(timedOut)[0]).toMatchObject({ type: 'MISSED', participantId: 'a', timedOut: true });
    expect(timedOut.state.turnOf).toBe('b');

    const strict = new GridRules({ ...config, skipsPerRound: 0 });
    const skipped = ok(strict.handleCommand(start(strict).state, 'a', { type: 'GRID_SKIP' }, at(10)));
    expect(endOf(skipped)).toMatchObject({ result: { endReason: 'SKIP_LIMIT', winnerParticipantId: 'b' } });
  });

  it('ends as a draw after maxTurns turns', () => {
    const short = new GridRules({ ...config, maxTurns: 1 });
    const step = short.handleTimer(start(short).state, TURN_TIMER, at(10_300));
    expect(endOf(step)).toMatchObject({ result: { endReason: 'MAX_TURNS', points: { a: 3, b: 3 } } });
  });

  it('gives the round to the other player when one leaves', () => {
    expect(endOf(rules.participantLeft(start().state, 'a'))).toMatchObject({
      result: { endReason: 'FORFEIT', winnerParticipantId: 'b' },
    });
  });
});
