import { SeededRandom } from '../random-source';
import { isRejection } from './game-rules';
import {
  ONE_TWO_PASS_TYPES,
  type OneTwoCommand,
  type OneTwoConfig,
  type OneTwoRoundState,
  OneTwoRules,
  type PassAvailability,
  PHASE_TIMER,
  readBurnedNames,
} from './one-two-rules';

const config: OneTwoConfig = {
  pickMs: 5_000,
  answerMs: 10_000,
  offerCount: 3,
  minAnswers: 3,
  maxPasses: 4,
  passTypes: ONE_TWO_PASS_TYPES,
  latencyGraceMs: 300,
  showWrongAnswers: true,
  points: { rallyWin: 1 },
};
const T0 = new Date('2026-11-20T20:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);
const random = () => new SeededRandom(7);

const rules = new OneTwoRules(config);
type Step = ReturnType<OneTwoRules['startRound']>;
const ok = (result: ReturnType<OneTwoRules['handleCommand']>): Step => {
  if (isRejection(result)) throw new Error(`rejected ${result.code}`);
  return result;
};
const codeOf = (result: ReturnType<OneTwoRules['handleCommand']>) => (isRejection(result) ? result.code : null);
const events = (step: Step) => step.effects.flatMap((effect) => (effect.type === 'EMIT' ? [effect.event] : []));
const endOf = (step: Step) => {
  const end = step.effects.find((effect) => effect.type === 'END_ROUND');
  return end?.type === 'END_ROUND' ? end.result : null;
};

/** Ramos as the seed: three full pass types; a passes first. */
const seedAvailability: PassAvailability = {
  FACED_IN_FINAL: 5,
  SCORED_IN_SAME_MATCH: 4,
  FACED_IN_KNOCKOUT: 9,
  ASSIST_GIVEN: 1,
};
const start = (availability = seedAvailability, burned: string[] = [], rulesUsed = rules) =>
  rulesUsed.startRound(1, ['a', 'b'], 'ramos', 'a', burned, availability, T0, random());
const send = (state: OneTwoRoundState, who: string, command: OneTwoCommand, ms = 1_000) =>
  rules.handleCommand(state, who, command, at(ms), random());
const passed = (passType = 'FACED_IN_FINAL' as const) =>
  ok(send(start().state, 'a', { type: 'ONE_TWO_PASS', passType }));
const answer = (
  state: OneTwoRoundState,
  who: string,
  entityId: string | null,
  linked = true,
  nextAvailability: PassAvailability = seedAvailability,
  ms = 2_000,
) => send(state, who, { type: 'ONE_TWO_ANSWER', answer: { entityId }, linked, nextAvailability }, ms);

describe('OneTwoRules', () => {
  it('offers the full pass types of the seed, in a fixed order, and burns the seed', () => {
    const step = start();
    expect(events(step)).toEqual([
      {
        type: 'OFFER',
        roundNo: 1,
        ball: 'ramos',
        passer: 'a',
        passTypes: ['FACED_IN_FINAL', 'FACED_IN_KNOCKOUT', 'SCORED_IN_SAME_MATCH'],
        pickDeadlineAt: at(5_000),
      },
    ]);
    expect(step.effects).toContainEqual({ type: 'SCHEDULE', timer: PHASE_TIMER, at: at(5_300) });
    expect(step.state.used).toEqual(['ramos']);
  });

  it('offers at most offerCount types, picked at random among the full ones', () => {
    const many: PassAvailability = Object.fromEntries(ONE_TWO_PASS_TYPES.map((type) => [type, 10]));
    const offers = [1, 2, 3, 4, 5].map(
      (seed) => rules.startRound(1, ['a', 'b'], 'ramos', 'a', [], many, T0, new SeededRandom(seed)).state.offer,
    );
    expect(offers.every((offer) => offer.length === 3)).toBe(true);
    expect(new Set(offers.map((offer) => offer.join())).size).toBeGreaterThan(1);
  });

  it('falls back to pass types with any answer, and ends with no winner at a dead end', () => {
    expect(start({ ASSIST_GIVEN: 1, SCORED_AGAINST: 2 }).state.offer).toEqual(['ASSIST_GIVEN', 'SCORED_AGAINST']);
    const dead = start({ FACED_IN_FINAL: 0 });
    expect(endOf(dead)).toMatchObject({ winnerParticipantId: null, endReason: 'DEAD_END', points: {} });
  });

  it('offers only the pass types the config enables', () => {
    const onlyFinals = new OneTwoRules({ ...config, passTypes: ['FACED_IN_FINAL'] });
    expect(start(seedAvailability, [], onlyFinals).state.offer).toEqual(['FACED_IN_FINAL']);
  });

  it('only the passer passes, an offered type, in time; then the receiver has answerMs', () => {
    const state = start().state;
    expect(codeOf(send(state, 'b', { type: 'ONE_TWO_PASS', passType: 'FACED_IN_FINAL' }))).toBe('NOT_YOUR_TURN');
    expect(codeOf(send(state, 'a', { type: 'ONE_TWO_PASS', passType: 'CONCEDED_TO' }))).toBe('NOT_OFFERED');
    expect(codeOf(send(state, 'a', { type: 'ONE_TWO_PASS', passType: 'FACED_IN_FINAL' }, 5_301))).toBe(
      'PICK_WINDOW_CLOSED',
    );
    const step = passed();
    expect(events(step)).toEqual([
      {
        type: 'PASSED',
        roundNo: 1,
        passType: 'FACED_IN_FINAL',
        receiver: 'b',
        answerDeadlineAt: at(11_000),
        random: false,
      },
    ]);
    expect(codeOf(send(step.state, 'a', { type: 'ONE_TWO_PASS', passType: 'FACED_IN_FINAL' }))).toBe('ALREADY_PASSED');
  });

  it('picks an offered type at random when the passer runs out of time', () => {
    const step = rules.handleTimer(start().state, PHASE_TIMER, at(5_300), random());
    const [event] = events(step);
    expect(event).toMatchObject({ type: 'PASSED', random: true, receiver: 'b' });
    expect(step.state.phase).toBe('ANSWERING');
  });

  it('a right, unused name becomes the ball and the receiver passes next', () => {
    const step = ok(
      answer(passed().state, 'b', 'godin', true, { SCORED_IN_SAME_MATCH: 3, FACED_IN_FINAL: 4, ASSIST_RECEIVED: 3 }),
    );
    expect(events(step).map((event) => event.type)).toEqual(['RETURNED', 'OFFER']);
    expect(events(step)[0]).toEqual({
      type: 'RETURNED',
      roundNo: 1,
      entityId: 'godin',
      passType: 'FACED_IN_FINAL',
      participantId: 'b',
    });
    expect(step.state).toMatchObject({
      ball: 'godin',
      passer: 'b',
      receiver: 'a',
      phase: 'PICKING',
      used: ['ramos', 'godin'],
      chain: [{ entityId: 'godin', passType: 'FACED_IN_FINAL', returnedBy: 'b' }],
    });
    expect(step.state.offer).toEqual(['FACED_IN_FINAL', 'SCORED_IN_SAME_MATCH', 'ASSIST_RECEIVED']);
  });

  it('only the receiver answers, in time', () => {
    const state = passed().state;
    expect(codeOf(answer(state, 'a', 'godin'))).toBe('NOT_YOUR_TURN');
    expect(codeOf(answer(state, 'b', 'godin', true, seedAvailability, 11_301))).toBe('ANSWER_WINDOW_CLOSED');
  });

  it('a wrong name loses the rally: the passer wins it, and the opponent sees what the text matched', () => {
    const step = ok(answer(passed().state, 'b', 'messi', false));
    expect(events(step)).toEqual([
      { type: 'MISSED', roundNo: 1, participantId: 'b', reason: 'WRONG', entityId: 'messi' },
    ]);
    expect(endOf(step)).toMatchObject({ winnerParticipantId: 'a', endReason: 'MISSED', points: { a: 1 } });
    expect(step.effects).toContainEqual({
      type: 'RECORD_ACTION',
      action: expect.objectContaining({ participantId: 'b', kind: 'ONE_TWO_ANSWER', isCorrect: false }),
    });
    const hidden = new OneTwoRules({ ...config, showWrongAnswers: false });
    const hiddenStep = hidden.handleCommand(
      passed().state,
      'b',
      { type: 'ONE_TWO_ANSWER', answer: { entityId: 'messi' }, linked: false, nextAvailability: {} },
      at(2_000),
      random(),
    );
    expect(isRejection(hiddenStep) ? null : events(hiddenStep)[0]).toMatchObject({ entityId: null });
  });

  it('a name burned earlier in the battle, the seed included, loses the rally', () => {
    const burnedBefore = ok(
      rules.handleCommand(
        ok(send(start(seedAvailability, ['godin']).state, 'a', { type: 'ONE_TWO_PASS', passType: 'FACED_IN_FINAL' }))
          .state,
        'b',
        { type: 'ONE_TWO_ANSWER', answer: { entityId: 'godin' }, linked: true, nextAvailability: {} },
        at(2_000),
        random(),
      ),
    );
    expect(events(burnedBefore)[0]).toMatchObject({ type: 'MISSED', reason: 'BURNED', entityId: 'godin' });
    const back = ok(answer(passed().state, 'b', 'godin'));
    const toSeed = ok(
      send(back.state, 'b', { type: 'ONE_TWO_PASS', passType: back.state.offer[0] ?? 'FACED_IN_FINAL' }),
    );
    expect(events(ok(answer(toSeed.state, 'a', 'ramos', true, {}, 3_000)))[0]).toMatchObject({ reason: 'BURNED' });
  });

  it('no answer by the deadline loses the rally and counts as a wrong answer', () => {
    const step = rules.handleTimer(passed().state, PHASE_TIMER, at(11_300), random());
    expect(events(step)[0]).toMatchObject({ type: 'MISSED', participantId: 'b', reason: 'TIME_UP', entityId: null });
    expect(step.effects).toContainEqual({
      type: 'RECORD_ACTION',
      action: { participantId: 'b', kind: 'ONE_TWO_ANSWER', isCorrect: false, points: 0, at: at(11_300) },
    });
    expect(endOf(step)).toMatchObject({ winnerParticipantId: 'a', endReason: 'MISSED' });
  });

  it('ends with no winner after maxPasses returns', () => {
    let state = passed().state;
    const players = ['b', 'a'];
    let step: Step | null = null;
    for (let index = 0; index < config.maxPasses; index++) {
      step = ok(
        answer(state, players[index % 2] ?? 'b', `player${String(index)}`, true, seedAvailability, 2_000 + index),
      );
      state = step.state;
      if (state.phase === 'PICKING')
        state = ok(
          send(
            state,
            state.passer,
            { type: 'ONE_TWO_PASS', passType: state.offer[0] ?? 'FACED_IN_FINAL' },
            2_000 + index,
          ),
        ).state;
    }
    expect(step && endOf(step)).toMatchObject({ winnerParticipantId: null, endReason: 'MAX_PASSES', stepsRevealed: 4 });
  });

  it('hands the burned names to the next rally', () => {
    const step = ok(answer(passed().state, 'b', 'messi', false));
    expect(readBurnedNames(endOf(step)?.carryOver)).toEqual(['ramos']);
    expect(readBurnedNames(undefined)).toEqual([]);
    expect(start(seedAvailability, readBurnedNames({ used: ['godin'] })).state.used).toEqual(['godin', 'ramos']);
  });

  it('gives the rally to the other player when one leaves', () => {
    const step = rules.participantLeft(passed().state, 'b');
    expect(endOf(step)).toMatchObject({ winnerParticipantId: 'a', endReason: 'FORFEIT', points: {} });
  });
});
