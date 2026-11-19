import { SeededRandom } from '../random-source';
import { isRejection } from './game-rules';
import {
  BURY_TIMER,
  type MinesConfig,
  type MinesRoundState,
  MinesRules,
  type MinesStep,
  minesOf,
  TURN_TIMER,
} from './mines-rules';

const config: MinesConfig = {
  minesPerPlayer: 2,
  buryMs: 20_000,
  maxWrongBuryTries: 2,
  turnMs: 10_000,
  maxTurns: 40,
  hearts: 2,
  ownMine: 'REJECT',
  detectorCostMs: 3_000,
  latencyGraceMs: 300,
  showWrongAnswers: true,
  points: { roundWin: 3, roundDraw: 1, perSafeAnswer: 1 },
};
const CATEGORY = ['henry', 'pires', 'vieira', 'wiltord', 'petit', 'anelka'];
const T0 = new Date('2026-11-19T20:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

const ok = (result: MinesStep | ReturnType<MinesRules['handleCommand']>): MinesStep => {
  if (isRejection(result)) throw new Error(`rejected ${result.code}`);
  return result;
};
const events = (step: MinesStep) => step.effects.flatMap((effect) => (effect.type === 'EMIT' ? [effect.event] : []));
const endOf = (step: MinesStep) => step.effects.find((effect) => effect.type === 'END_ROUND');
const codeOf = (result: ReturnType<MinesRules['handleCommand']>) => (isRejection(result) ? result.code : null);

describe('MinesRules', () => {
  const rules = new MinesRules(config);
  const start = (rulesUsed = rules) => rulesUsed.startRound(1, ['a', 'b'], CATEGORY, 'a', { a: 1, b: 1 }, T0);
  const bury = (state: MinesRoundState, who: string, entityId: string, inCategory = true, ms = 100) =>
    rules.handleCommand(state, who, { type: 'MINE_BURY', answer: { entityId }, inCategory }, at(ms));
  const say = (state: MinesRoundState, who: string, entityId: string | null, inCategory = true, ms = 1_000) =>
    rules.handleCommand(state, who, { type: 'MINE_ANSWER', answer: { entityId }, inCategory }, at(ms));
  /** a buries henry + pires, b buries vieira + wiltord, and a takes the first turn. */
  const playing = (rulesUsed = rules) => {
    let state = start(rulesUsed).state;
    for (const [who, entityId] of [
      ['a', 'henry'],
      ['a', 'pires'],
      ['b', 'vieira'],
    ] as const)
      state = ok(
        rulesUsed.handleCommand(state, who, { type: 'MINE_BURY', answer: { entityId }, inCategory: true }, at(100)),
      ).state;
    return ok(
      rulesUsed.handleCommand(
        state,
        'b',
        { type: 'MINE_BURY', answer: { entityId: 'wiltord' }, inCategory: true },
        at(200),
      ),
    );
  };

  it('opens the burying phase with its deadline timer', () => {
    const step = start();
    expect(step.state.phase).toBe('BURYING');
    expect(events(step)).toEqual([{ type: 'ROUND_STARTED', roundNo: 1, buryDeadlineAt: at(20_000), firstTurn: 'a' }]);
    expect(step.effects).toContainEqual({ type: 'SCHEDULE', timer: BURY_TIMER, at: at(20_300) });
  });

  it('starts the turns as soon as everyone buried every mine', () => {
    const step = playing();
    expect(step.state.phase).toBe('TURNS');
    expect(events(step)).toEqual([
      { type: 'TURN', roundNo: 1, participantId: 'a', turnNo: 1, turnDeadlineAt: at(10_200) },
    ]);
    expect(minesOf(step.state, 'a').map((mine) => mine.entityId)).toEqual(['henry', 'pires']);
  });

  it('caps the names outside the category while burying, and refuses the same mine twice', () => {
    let state = start().state;
    const wrong = ok(bury(state, 'a', 'drogba', false));
    expect(wrong.refusal).toBe('NOT_IN_CATEGORY');
    state = ok(bury(wrong.state, 'a', 'drogba', false)).state;
    expect(codeOf(bury(state, 'a', 'henry'))).toBe('NO_TRIES_LEFT');
    state = ok(bury(start().state, 'a', 'henry')).state;
    expect(codeOf(bury(state, 'a', 'henry'))).toBe('ALREADY_BURIED');
    state = ok(bury(state, 'a', 'pires')).state;
    expect(codeOf(bury(state, 'a', 'vieira'))).toBe('ALL_MINES_BURIED');
    expect(codeOf(bury(state, 'b', 'vieira', true, 20_301))).toBe('BURY_WINDOW_CLOSED');
  });

  it('fills empty mine slots at the deadline with auto mines from the category', () => {
    const state = ok(bury(start().state, 'a', 'henry')).state;
    const step = rules.handleTimer(state, BURY_TIMER, at(20_300), new SeededRandom(7));
    expect(step.state.phase).toBe('TURNS');
    expect(minesOf(step.state, 'a')).toHaveLength(2);
    expect(minesOf(step.state, 'a')[0]).toEqual({ entityId: 'henry', auto: false });
    expect(minesOf(step.state, 'b').every((mine) => mine.auto && CATEGORY.includes(mine.entityId))).toBe(true);
    expect(step.effects.filter((effect) => effect.type === 'RECORD_ACTION')).toHaveLength(3);
  });

  it('a safe answer scores and passes the turn', () => {
    const step = ok(say(playing().state, 'a', 'petit'));
    expect(events(step)[0]).toEqual({
      type: 'ANSWERED',
      roundNo: 1,
      participantId: 'a',
      outcome: 'SAFE',
      entityId: 'petit',
      buriedBy: null,
    });
    expect(step.state.points).toEqual({ a: 1 });
    expect(step.state.turnOf).toBe('b');
  });

  it("stepping on the opponent's mine explodes it, names who buried it and costs a heart", () => {
    const step = ok(say(playing().state, 'a', 'vieira'));
    expect(events(step)[0]).toMatchObject({ outcome: 'MINE', entityId: 'vieira', buriedBy: 'b' });
    expect(step.state.hearts).toEqual({ a: 1, b: 2 });
    expect(rules.liveMinesAgainst(step.state, 'a').map((mine) => mine.entityId)).toEqual(['wiltord']);
    expect(codeOf(say(step.state, 'b', 'vieira'))).toBeNull();
    expect(events(ok(say(step.state, 'b', 'vieira')))[0]).toMatchObject({ outcome: 'REPEATED' });
  });

  it('a wrong name or a repeated one costs a heart; the wrong name is hidden unless showWrongAnswers', () => {
    const wrong = ok(say(playing().state, 'a', 'drogba', false));
    expect(events(wrong)[0]).toMatchObject({ outcome: 'WRONG', entityId: 'drogba' });
    expect(wrong.state.hearts.a).toBe(1);
    const hidden = new MinesRules({ ...config, showWrongAnswers: false });
    const step = ok(
      hidden.handleCommand(
        playing(hidden).state,
        'a',
        { type: 'MINE_ANSWER', answer: { entityId: 'drogba' }, inCategory: false },
        at(1_000),
      ),
    );
    expect(events(step)[0]).toMatchObject({ outcome: 'WRONG', entityId: null });
  });

  it('naming your own mine is refused by default and reveals nothing', () => {
    expect(codeOf(say(playing().state, 'a', 'henry'))).toBe('OWN_MINE');
  });

  it('with COSTS_HEART, naming your own mine costs a heart and keeps the mine hidden', () => {
    const strict = new MinesRules({ ...config, ownMine: 'COSTS_HEART' });
    const step = ok(
      strict.handleCommand(
        playing(strict).state,
        'a',
        { type: 'MINE_ANSWER', answer: { entityId: 'henry' }, inCategory: true },
        at(1_000),
      ),
    );
    expect(events(step)[0]).toMatchObject({ outcome: 'OWN_MINE', entityId: null, buriedBy: null });
    expect(step.state.hearts.a).toBe(1);
    expect(strict.isOwnLiveMine(step.state, 'a', 'henry')).toBe(true);
  });

  it('a timeout costs a heart and the last heart ends the round for the other player', () => {
    let state = ok(say(playing().state, 'a', 'drogba', false)).state;
    state = ok(say(state, 'b', 'petit')).state;
    const step = rules.handleTimer(state, TURN_TIMER, at(60_000), new SeededRandom(1));
    expect(events(step)[0]).toMatchObject({ participantId: 'a', outcome: 'TIMEOUT' });
    expect(endOf(step)).toEqual({
      type: 'END_ROUND',
      result: { winnerParticipantId: 'b', endReason: 'LAST_HEART', points: { b: 4 }, stepsRevealed: 3 },
    });
    expect(step.state.phase).toBe('CLOSED');
  });

  it('ends on the tie-break when no safe answer is left: hearts first, then safe answers', () => {
    // Safe left after the mines: petit, anelka.
    let state = ok(say(playing().state, 'a', 'petit')).state;
    const step = ok(say(state, 'b', 'anelka'));
    expect(endOf(step)).toMatchObject({ result: { winnerParticipantId: null, endReason: 'NO_SAFE_ANSWERS' } });
    state = ok(say(playing().state, 'a', 'petit')).state;
    state = ok(say(state, 'b', 'drogba', false)).state;
    const won = ok(say(state, 'a', 'anelka'));
    expect(endOf(won)).toMatchObject({ result: { winnerParticipantId: 'a', endReason: 'NO_SAFE_ANSWERS' } });
  });

  it('ends at maxTurns with the same tie-break', () => {
    const short = new MinesRules({ ...config, maxTurns: 1 });
    const step = ok(
      short.handleCommand(
        playing(short).state,
        'a',
        { type: 'MINE_ANSWER', answer: { entityId: 'petit' }, inCategory: true },
        at(1_000),
      ),
    );
    expect(endOf(step)).toMatchObject({ result: { winnerParticipantId: 'a', endReason: 'MAX_TURNS' } });
  });

  it('the detector tells only whether a name is a live mine of the opponent, and costs time once', () => {
    const state = playing().state;
    const scanned = ok(rules.handleCommand(state, 'a', { type: 'MINE_SCAN', entityId: 'vieira' }, at(1_000)));
    expect(events(scanned)).toEqual([
      { type: 'SCANNED', roundNo: 1, participantId: 'a', turnDeadlineAt: at(7_200), result: 'MINE' },
    ]);
    expect(scanned.effects).toContainEqual({ type: 'SCHEDULE', timer: TURN_TIMER, at: at(7_500) });
    expect(scanned.state.turnOf).toBe('a');
    expect(codeOf(rules.handleCommand(scanned.state, 'a', { type: 'MINE_SCAN', entityId: 'petit' }, at(1_500)))).toBe(
      'NO_DETECTOR_LEFT',
    );
    const own = ok(rules.handleCommand(state, 'a', { type: 'MINE_SCAN', entityId: 'henry' }, at(1_000)));
    expect(events(own)[0]).toMatchObject({ result: 'CLEAR' });
  });

  it('only the player on turn may answer or scan', () => {
    const state = playing().state;
    expect(codeOf(say(state, 'b', 'petit'))).toBe('NOT_YOUR_TURN');
    expect(codeOf(say(state, 'a', 'petit', true, 10_501))).toBe('TURN_CLOSED');
  });

  it('a forfeit gives the round to the other player without round points', () => {
    const step = rules.participantLeft(playing().state, 'a');
    expect(endOf(step)).toMatchObject({ result: { winnerParticipantId: 'b', endReason: 'FORFEIT', points: {} } });
  });

  it('never puts a live mine of one player in an event the other player gets', () => {
    let step = playing();
    const seen = [...events(step)];
    for (const [who, name] of [
      ['a', 'petit'],
      ['b', 'anelka'],
    ] as const) {
      step = ok(say(step.state, who, name));
      seen.push(...events(step));
    }
    const json = JSON.stringify(seen);
    for (const mine of ['henry', 'pires', 'vieira', 'wiltord']) expect(json).not.toContain(mine);
  });
});
