import { isRejection, type RulesStep } from './game-rules';
import {
  ANSWER_TIMER,
  FINAL_TIMER,
  REVEAL_TIMER,
  type RevealAndBuzzConfig,
  RevealAndBuzzRules,
  type RevealEvent,
  type RevealRoundState,
} from './reveal-and-buzz-rules';

const config: RevealAndBuzzConfig = {
  revealIntervalMs: 2_000,
  resumeDelayMs: 1_000,
  answerWindowMs: 5_000,
  finalWindowMs: 3_000,
  attemptsPerPlayer: 1,
  latencyGraceMs: 300,
  showWrongAnswers: true,
  points: { correct: 10, perUnrevealedStep: 2, wrong: -3 },
};
const T0 = new Date('2026-11-11T20:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);
const SPAIN = { entityId: 'spain' };
const NANI = { entityId: 'nani' };

type Step = RulesStep<RevealRoundState, RevealEvent>;

function expectStep(result: Step | ReturnType<RevealAndBuzzRules['handleCommand']>): Step {
  if (isRejection(result)) throw new Error(`unexpected rejection ${result.code}`);
  return result;
}

const events = (step: Step) => step.effects.flatMap((effect) => (effect.type === 'EMIT' ? [effect.event] : []));
const scheduled = (step: Step) => step.effects.flatMap((effect) => (effect.type === 'SCHEDULE' ? [effect] : []));
const endOf = (step: Step) => step.effects.find((effect) => effect.type === 'END_ROUND');

describe('RevealAndBuzzRules', () => {
  const rules = new RevealAndBuzzRules(config);
  const start = (stepCount = 4) => rules.startRound(1, stepCount, ['p1', 'p2'], T0);

  it('starts with the first clue and schedules the next reveal', () => {
    const step = start();

    expect(events(step)).toEqual([
      { type: 'ROUND_STARTED', roundNo: 1, stepCount: 4 },
      { type: 'CLUE_REVEALED', roundNo: 1, index: 1, nextClueAt: at(2_000) },
    ]);
    expect(scheduled(step)).toEqual([{ type: 'SCHEDULE', timer: REVEAL_TIMER, at: at(2_000) }]);
    expect(step.state).toMatchObject({ phase: 'REVEALING', stepsRevealed: 1 });
  });

  it('reveals step by step, then opens the final window after the last step', () => {
    let step = start(2);
    step = rules.handleTimer(step.state, REVEAL_TIMER, at(2_000));

    expect(events(step)).toEqual([{ type: 'CLUE_REVEALED', roundNo: 1, index: 2, nextClueAt: null }]);
    expect(scheduled(step)).toEqual([{ type: 'SCHEDULE', timer: FINAL_TIMER, at: at(5_000) }]);
    expect(step.state.phase).toBe('FINAL_WINDOW');
  });

  it('pauses the reveal on the first buzz and refuses a second one', () => {
    const buzzed = expectStep(rules.handleCommand(start().state, 'p1', { type: 'BUZZ' }, at(500)));

    expect(buzzed.effects).toEqual(
      expect.arrayContaining([
        { type: 'CANCEL', timer: REVEAL_TIMER },
        { type: 'SCHEDULE', timer: ANSWER_TIMER, at: at(5_800) },
      ]),
    );
    expect(events(buzzed)).toEqual([{ type: 'BUZZED', roundNo: 1, participantId: 'p1', answerDeadlineAt: at(5_500) }]);
    expect(rules.handleCommand(buzzed.state, 'p2', { type: 'BUZZ' }, at(600))).toEqual({
      rejected: true,
      code: 'BUZZ_TAKEN',
    });
  });

  it('gives the winner the correct points plus a bonus for every step not yet revealed', () => {
    const buzzed = expectStep(rules.handleCommand(start(4).state, 'p1', { type: 'BUZZ' }, at(500)));
    const answered = expectStep(
      rules.handleCommand(buzzed.state, 'p1', { type: 'ANSWER', answer: SPAIN, verdict: 'CORRECT' }, at(1_500)),
    );

    expect(endOf(answered)).toEqual({
      type: 'END_ROUND',
      result: { winnerParticipantId: 'p1', endReason: 'CORRECT', points: { p1: 16 }, stepsRevealed: 1 },
    });
    expect(answered.state.phase).toBe('CLOSED');
  });

  it('locks out a wrong answer and resumes after what was left of the interval, at least the resume delay', () => {
    const buzzed = expectStep(rules.handleCommand(start().state, 'p1', { type: 'BUZZ' }, at(500)));
    const wrong = expectStep(
      rules.handleCommand(buzzed.state, 'p1', { type: 'ANSWER', answer: NANI, verdict: 'WRONG' }, at(2_000)),
    );

    // 1.5 s of the 2 s interval were left when p1 buzzed; that is more than the 1 s resume delay.
    expect(events(wrong)).toEqual([
      { type: 'WRONG_ANSWER', roundNo: 1, participantId: 'p1', answer: NANI, timedOut: false },
      { type: 'RESUMED', roundNo: 1, nextClueAt: at(3_500) },
    ]);
    expect(scheduled(wrong)).toEqual([{ type: 'SCHEDULE', timer: REVEAL_TIMER, at: at(3_500) }]);
    expect(rules.handleCommand(wrong.state, 'p1', { type: 'BUZZ' }, at(2_100))).toEqual({
      rejected: true,
      code: 'LOCKED_OUT',
    });
    expect(wrong.state.points).toEqual({ p1: -3 });
  });

  it('uses the resume delay when less of the interval was left', () => {
    const buzzed = expectStep(rules.handleCommand(start().state, 'p1', { type: 'BUZZ' }, at(1_900)));
    const wrong = expectStep(
      rules.handleCommand(buzzed.state, 'p1', { type: 'ANSWER', answer: NANI, verdict: 'WRONG' }, at(3_000)),
    );
    expect(scheduled(wrong)).toEqual([{ type: 'SCHEDULE', timer: REVEAL_TIMER, at: at(4_000) }]);
  });

  it('hides the wrong answer when showWrongAnswers is off', () => {
    const quiet = new RevealAndBuzzRules({ ...config, showWrongAnswers: false });
    const buzzed = expectStep(
      quiet.handleCommand(quiet.startRound(1, 4, ['p1', 'p2'], T0).state, 'p1', { type: 'BUZZ' }, T0),
    );
    const wrong = expectStep(
      quiet.handleCommand(buzzed.state, 'p1', { type: 'ANSWER', answer: NANI, verdict: 'WRONG' }, at(100)),
    );
    expect(events(wrong)[0]).toMatchObject({ type: 'WRONG_ANSWER', answer: null });
  });

  it('treats a missing answer as a timeout without the wrong-answer penalty', () => {
    const buzzed = expectStep(rules.handleCommand(start().state, 'p1', { type: 'BUZZ' }, at(500)));
    const timedOut = rules.handleTimer(buzzed.state, ANSWER_TIMER, at(5_800));

    expect(events(timedOut)[0]).toEqual({
      type: 'WRONG_ANSWER',
      roundNo: 1,
      participantId: 'p1',
      answer: null,
      timedOut: true,
    });
    expect(timedOut.effects).toContainEqual({
      type: 'RECORD_ACTION',
      action: { participantId: 'p1', kind: 'ANSWER_TIMEOUT', points: 0, at: at(5_800) },
    });
    expect(timedOut.state.points).toEqual({});
  });

  it('closes the round when every participant is locked out, keeping the penalties', () => {
    let state = start().state;
    for (const [participant, ms] of [
      ['p1', 100],
      ['p2', 1_200],
    ] as const) {
      state = expectStep(rules.handleCommand(state, participant, { type: 'BUZZ' }, at(ms))).state;
      const step = expectStep(
        rules.handleCommand(state, participant, { type: 'ANSWER', answer: NANI, verdict: 'WRONG' }, at(ms + 100)),
      );
      state = step.state;
      if (participant === 'p2') {
        expect(endOf(step)).toEqual({
          type: 'END_ROUND',
          result: {
            winnerParticipantId: null,
            endReason: 'ALL_LOCKED_OUT',
            points: { p1: -3, p2: -3 },
            stepsRevealed: 1,
          },
        });
      }
    }
  });

  it('ends without a winner when the final window runs out', () => {
    const lastClue = rules.handleTimer(start(2).state, REVEAL_TIMER, at(2_000));
    const closed = rules.handleTimer(lastClue.state, FINAL_TIMER, at(5_000));
    expect(endOf(closed)).toEqual({
      type: 'END_ROUND',
      result: { winnerParticipantId: null, endReason: 'NO_WINNER', points: {}, stepsRevealed: 2 },
    });
  });

  it('returns to the final window after a wrong answer there, with no next clue', () => {
    const lastClue = rules.handleTimer(start(2).state, REVEAL_TIMER, at(2_000));
    const buzzed = expectStep(rules.handleCommand(lastClue.state, 'p2', { type: 'BUZZ' }, at(4_000)));
    expect(buzzed.effects).toContainEqual({ type: 'CANCEL', timer: FINAL_TIMER });

    const wrong = expectStep(
      rules.handleCommand(buzzed.state, 'p2', { type: 'ANSWER', answer: NANI, verdict: 'WRONG' }, at(4_500)),
    );
    expect(events(wrong)[1]).toEqual({ type: 'RESUMED', roundNo: 1, nextClueAt: null });
    expect(scheduled(wrong)).toEqual([{ type: 'SCHEDULE', timer: FINAL_TIMER, at: at(5_500) }]);
    expect(wrong.state.phase).toBe('FINAL_WINDOW');
  });

  it('accepts an answer only from the buzz holder and within the window plus the latency grace', () => {
    const buzzed = expectStep(rules.handleCommand(start().state, 'p1', { type: 'BUZZ' }, at(0)));
    const answer = { type: 'ANSWER', answer: SPAIN, verdict: 'CORRECT' } as const;

    expect(rules.handleCommand(buzzed.state, 'p2', answer, at(100))).toEqual({
      rejected: true,
      code: 'NOT_BUZZ_HOLDER',
    });
    expect(rules.handleCommand(buzzed.state, 'p1', answer, at(5_301))).toEqual({
      rejected: true,
      code: 'ANSWER_WINDOW_CLOSED',
    });
    expect(isRejection(rules.handleCommand(buzzed.state, 'p1', answer, at(5_300)))).toBe(false);
  });

  it('refuses commands after the round closed and ignores a timer that fired too late', () => {
    const lastClue = rules.handleTimer(start(1).state, FINAL_TIMER, at(3_000));
    expect(rules.handleCommand(lastClue.state, 'p1', { type: 'BUZZ' }, at(3_100))).toEqual({
      rejected: true,
      code: 'ROUND_CLOSED',
    });
    expect(rules.handleTimer(lastClue.state, REVEAL_TIMER, at(3_200))).toEqual({ state: lastClue.state, effects: [] });
  });

  it('refuses a buzz from someone who is not in the round', () => {
    expect(rules.handleCommand(start().state, 'stranger', { type: 'BUZZ' }, at(10))).toEqual({
      rejected: true,
      code: 'PARTICIPANT_FORFEITED',
    });
  });
});
