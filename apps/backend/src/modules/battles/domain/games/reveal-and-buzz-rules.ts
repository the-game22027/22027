import {
  type Effect,
  type ParticipantId,
  type Rejection,
  reject,
  type RoundAction,
  type RoundResult,
  type RulesStep,
  type JudgedAnswer,
} from './game-rules';

/** Reveal-and-buzz values of one game type (08 §6). Every number is configuration (DEC-54, DEC-60, DEC-33). */
export interface RevealAndBuzzConfig {
  revealIntervalMs: number;
  resumeDelayMs: number;
  answerWindowMs: number;
  finalWindowMs: number;
  attemptsPerPlayer: number;
  latencyGraceMs: number;
  showWrongAnswers: boolean;
  points: { correct: number; perUnrevealedStep: number; wrong: number };
}

export type RevealPhase = 'REVEALING' | 'ANSWERING' | 'FINAL_WINDOW' | 'CLOSED';

export interface RevealRoundState {
  roundNo: number;
  stepCount: number;
  stepsRevealed: number;
  phase: RevealPhase;
  participants: ParticipantId[];
  attemptsUsed: Record<ParticipantId, number>;
  buzzHolder: ParticipantId | null;
  answerDeadlineAt: Date | null;
  /** When the next reveal (or the end of the final window) is due while the clock runs. */
  nextDeadlineAt: Date | null;
  /** How much of that wait was left when a buzz paused it. */
  pausedRemainingMs: number | null;
  /** Points earned so far in this round (penalties for wrong answers, then the winner's points). */
  points: Record<ParticipantId, number>;
}

/** What happened in a round, in game terms; the engine turns these into localized protocol events. */
export type RevealEvent =
  | { type: 'ROUND_STARTED'; roundNo: number; stepCount: number }
  | { type: 'CLUE_REVEALED'; roundNo: number; index: number; nextClueAt: Date | null }
  | { type: 'BUZZED'; roundNo: number; participantId: ParticipantId; answerDeadlineAt: Date }
  | {
      type: 'WRONG_ANSWER';
      roundNo: number;
      participantId: ParticipantId;
      answer: JudgedAnswer | null;
      timedOut: boolean;
    }
  | { type: 'RESUMED'; roundNo: number; nextClueAt: Date | null };

/** The server's judgment of a typed answer, made before the rules see it (AnswerChecker, 08 §5.3). */
export type AnswerVerdict = 'CORRECT' | 'WRONG';

export type RevealCommand = { type: 'BUZZ' } | { type: 'ANSWER'; answer: JudgedAnswer; verdict: AnswerVerdict };

export const REVEAL_TIMER = 'reveal';
export const ANSWER_TIMER = 'answer';
export const FINAL_TIMER = 'final';

type Step = RulesStep<RevealRoundState, RevealEvent>;

/**
 * The reveal-and-buzz mechanic shared by BUZZER, CAREER and WHO_IS_PLAYER (08 §3.1). Pure: no I/O, time
 * passed in. The state diagram is in 08 §3.1.
 */
export class RevealAndBuzzRules {
  constructor(private readonly config: RevealAndBuzzConfig) {}

  startRound(roundNo: number, stepCount: number, participants: ParticipantId[], now: Date): Step {
    const state: RevealRoundState = {
      roundNo,
      stepCount,
      stepsRevealed: 0,
      phase: 'REVEALING',
      participants: [...participants],
      attemptsUsed: Object.fromEntries(participants.map((id) => [id, 0])),
      buzzHolder: null,
      answerDeadlineAt: null,
      nextDeadlineAt: null,
      pausedRemainingMs: null,
      points: {},
    };
    const started: Effect<RevealEvent> = { type: 'EMIT', event: { type: 'ROUND_STARTED', roundNo, stepCount } };
    const firstClue = this.revealNextStep(state, now);
    return { state: firstClue.state, effects: [started, ...firstClue.effects] };
  }

  /** Checks a buzz without changing anything; the engine calls handleBuzz only when this returns null. */
  findBuzzRejection(state: RevealRoundState, from: ParticipantId): Rejection | null {
    if (state.phase === 'CLOSED') return reject('ROUND_CLOSED');
    if (!state.participants.includes(from)) return reject('PARTICIPANT_FORFEITED');
    if (state.phase === 'ANSWERING') return reject('BUZZ_TAKEN');
    if (this.isLockedOut(state, from)) return reject('LOCKED_OUT');
    return null;
  }

  /**
   * Checks an answer before the engine spends a database lookup on judging it. The deadline includes the
   * latency grace (WEBSOCKET.md §5).
   */
  findAnswerRejection(state: RevealRoundState, from: ParticipantId, receivedAt: Date): Rejection | null {
    if (state.phase === 'CLOSED') return reject('ROUND_CLOSED');
    if (state.phase !== 'ANSWERING' || state.buzzHolder !== from) return reject('NOT_BUZZ_HOLDER');
    if (
      state.answerDeadlineAt &&
      receivedAt.getTime() > state.answerDeadlineAt.getTime() + this.config.latencyGraceMs
    ) {
      return reject('ANSWER_WINDOW_CLOSED');
    }
    return null;
  }

  handleCommand(state: RevealRoundState, from: ParticipantId, command: RevealCommand, now: Date): Step | Rejection {
    if (command.type === 'BUZZ') return this.findBuzzRejection(state, from) ?? this.acceptBuzz(state, from, now);
    return this.findAnswerRejection(state, from, now) ?? this.acceptAnswer(state, from, command, now);
  }

  handleTimer(state: RevealRoundState, timer: string, now: Date): Step {
    if (timer === REVEAL_TIMER && state.phase === 'REVEALING') return this.revealNextStep(state, now);
    if (timer === ANSWER_TIMER && state.phase === 'ANSWERING' && state.buzzHolder) {
      return this.lockOutAndContinue(state, state.buzzHolder, { answer: null, timedOut: true }, now);
    }
    if (timer === FINAL_TIMER && state.phase === 'FINAL_WINDOW') return this.closeRound(state, null, 'NO_WINNER');
    // A timer for a phase that already ended (cancelled too late): nothing to do.
    return { state, effects: [] };
  }

  /**
   * A participant left the battle (forfeit or grace expired) mid-round (08 §3.1 step 7). A held buzz is
   * released like a timeout, with no penalty, and the reveal resumes for the others.
   */
  participantLeft(state: RevealRoundState, who: ParticipantId, now: Date): Step {
    if (state.phase === 'CLOSED' || !state.participants.includes(who)) return { state, effects: [] };
    const remaining: RevealRoundState = { ...state, participants: state.participants.filter((id) => id !== who) };
    if (state.buzzHolder === who) {
      const next = this.lockOutAndContinue(remaining, who, { answer: null, timedOut: true }, now);
      return { state: next.state, effects: [{ type: 'CANCEL', timer: ANSWER_TIMER }, ...next.effects] };
    }
    if (remaining.participants.every((id) => this.isLockedOut(remaining, id))) {
      return this.closeRound(remaining, null, 'ALL_LOCKED_OUT');
    }
    return { state: remaining, effects: [] };
  }

  /** Whether this participant may not buzz again this round. */
  isLockedOut(state: RevealRoundState, participant: ParticipantId): boolean {
    return (state.attemptsUsed[participant] ?? 0) >= this.config.attemptsPerPlayer;
  }

  private revealNextStep(state: RevealRoundState, now: Date): Step {
    const index = state.stepsRevealed + 1;
    const isLast = index >= state.stepCount;
    const waitMs = isLast ? this.config.finalWindowMs : this.config.revealIntervalMs;
    const deadline = new Date(now.getTime() + waitMs);
    return {
      state: {
        ...state,
        stepsRevealed: index,
        phase: isLast ? 'FINAL_WINDOW' : 'REVEALING',
        nextDeadlineAt: deadline,
        pausedRemainingMs: null,
      },
      effects: [
        {
          type: 'EMIT',
          event: { type: 'CLUE_REVEALED', roundNo: state.roundNo, index, nextClueAt: isLast ? null : deadline },
        },
        { type: 'SCHEDULE', timer: isLast ? FINAL_TIMER : REVEAL_TIMER, at: deadline },
      ],
    };
  }

  private acceptBuzz(state: RevealRoundState, from: ParticipantId, now: Date): Step {
    const answerDeadlineAt = new Date(now.getTime() + this.config.answerWindowMs);
    const runningTimer = state.phase === 'FINAL_WINDOW' ? FINAL_TIMER : REVEAL_TIMER;
    const pausedRemainingMs = state.nextDeadlineAt ? Math.max(0, state.nextDeadlineAt.getTime() - now.getTime()) : 0;
    return {
      state: {
        ...state,
        phase: 'ANSWERING',
        buzzHolder: from,
        answerDeadlineAt,
        nextDeadlineAt: null,
        pausedRemainingMs,
      },
      effects: [
        { type: 'CANCEL', timer: runningTimer },
        { type: 'RECORD_ACTION', action: { participantId: from, kind: 'BUZZ', points: 0, at: now } },
        { type: 'EMIT', event: { type: 'BUZZED', roundNo: state.roundNo, participantId: from, answerDeadlineAt } },
        // The grace lets an answer sent just before the deadline still arrive (WEBSOCKET.md §5).
        {
          type: 'SCHEDULE',
          timer: ANSWER_TIMER,
          at: new Date(answerDeadlineAt.getTime() + this.config.latencyGraceMs),
        },
      ],
    };
  }

  private acceptAnswer(
    state: RevealRoundState,
    from: ParticipantId,
    command: Extract<RevealCommand, { type: 'ANSWER' }>,
    now: Date,
  ): Step {
    if (command.verdict === 'CORRECT') {
      const unrevealed = state.stepCount - state.stepsRevealed;
      const points = this.config.points.correct + this.config.points.perUnrevealedStep * unrevealed;
      const action: RoundAction = {
        participantId: from,
        kind: 'ANSWER',
        answer: command.answer,
        isCorrect: true,
        points,
        at: now,
      };
      const closed = this.closeRound(addPoints(state, from, points), from, 'CORRECT');
      return {
        state: closed.state,
        effects: [{ type: 'CANCEL', timer: ANSWER_TIMER }, { type: 'RECORD_ACTION', action }, ...closed.effects],
      };
    }
    const next = this.lockOutAndContinue(state, from, { answer: command.answer, timedOut: false }, now);
    return { state: next.state, effects: [{ type: 'CANCEL', timer: ANSWER_TIMER }, ...next.effects] };
  }

  /** A wrong or missing answer: the holder loses an attempt, then the reveal resumes or the round ends. */
  private lockOutAndContinue(
    state: RevealRoundState,
    holder: ParticipantId,
    { answer, timedOut }: { answer: JudgedAnswer | null; timedOut: boolean },
    now: Date,
  ): Step {
    // TODO(DEC-33): whether running out of time costs the same as a wrong answer; for now only a wrong answer does.
    const penalty = timedOut ? 0 : this.config.points.wrong;
    const attemptsUsed = { ...state.attemptsUsed, [holder]: (state.attemptsUsed[holder] ?? 0) + 1 };
    const afterAnswer: RevealRoundState = {
      ...addPoints(state, holder, penalty),
      attemptsUsed,
      buzzHolder: null,
      answerDeadlineAt: null,
    };
    const action: RoundAction = timedOut
      ? { participantId: holder, kind: 'ANSWER_TIMEOUT', points: 0, at: now }
      : {
          participantId: holder,
          kind: 'ANSWER',
          answer: answer ?? undefined,
          isCorrect: false,
          points: penalty,
          at: now,
        };
    const wrong: Effect<RevealEvent> = {
      type: 'EMIT',
      event: {
        type: 'WRONG_ANSWER',
        roundNo: state.roundNo,
        participantId: holder,
        answer: this.config.showWrongAnswers ? answer : null,
        timedOut,
      },
    };
    if (afterAnswer.participants.every((id) => this.isLockedOut(afterAnswer, id))) {
      const closed = this.closeRound(afterAnswer, null, 'ALL_LOCKED_OUT');
      return { state: closed.state, effects: [{ type: 'RECORD_ACTION', action }, wrong, ...closed.effects] };
    }

    const allRevealed = afterAnswer.stepsRevealed >= afterAnswer.stepCount;
    const waitMs = Math.max(state.pausedRemainingMs ?? 0, this.config.resumeDelayMs);
    const resumeAt = new Date(now.getTime() + waitMs);
    return {
      state: {
        ...afterAnswer,
        phase: allRevealed ? 'FINAL_WINDOW' : 'REVEALING',
        nextDeadlineAt: resumeAt,
        pausedRemainingMs: null,
      },
      effects: [
        { type: 'RECORD_ACTION', action },
        wrong,
        { type: 'EMIT', event: { type: 'RESUMED', roundNo: state.roundNo, nextClueAt: allRevealed ? null : resumeAt } },
        { type: 'SCHEDULE', timer: allRevealed ? FINAL_TIMER : REVEAL_TIMER, at: resumeAt },
      ],
    };
  }

  private closeRound(state: RevealRoundState, winner: ParticipantId | null, endReason: RoundResult['endReason']): Step {
    return {
      state: { ...state, phase: 'CLOSED', buzzHolder: null, answerDeadlineAt: null, nextDeadlineAt: null },
      effects: [
        { type: 'CANCEL', timer: REVEAL_TIMER },
        { type: 'CANCEL', timer: FINAL_TIMER },
        {
          type: 'END_ROUND',
          result: { winnerParticipantId: winner, endReason, points: state.points, stepsRevealed: state.stepsRevealed },
        },
      ],
    };
  }
}

function addPoints(state: RevealRoundState, participant: ParticipantId, points: number): RevealRoundState {
  if (points === 0) return state;
  return { ...state, points: { ...state.points, [participant]: (state.points[participant] ?? 0) + points } };
}
