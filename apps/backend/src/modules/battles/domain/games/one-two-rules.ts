import type { RandomSource } from '../random-source';
import {
  type Effect,
  type JudgedAnswer,
  type ParticipantId,
  type Rejection,
  reject,
  type RoundAction,
  type RoundResult,
  type RulesStep,
} from './game-rules';
import { addUsedAnswer, hasAnswerBeenUsed, type UsedAnswers } from './shared/used-answers';

/** How a receiver must be linked to the ball (08 §15.4); question-bank's `PassType`, repeated to keep the domain plain. */
export const ONE_TWO_PASS_TYPES = [
  'FACED_IN_FINAL',
  'FACED_IN_KNOCKOUT',
  'SCORED_IN_SAME_MATCH',
  'ASSIST_GIVEN',
  'ASSIST_RECEIVED',
  'SCORED_AGAINST',
  'CONCEDED_TO',
] as const;
export type OneTwoPassType = (typeof ONE_TWO_PASS_TYPES)[number];

/** Neighbours of the ball not named yet in this battle, per pass type (the runner counts them). */
export type PassAvailability = Partial<Record<OneTwoPassType, number>>;

/** `ONE_TWO` values of the battle config (08 §15.6). Every number is configuration (DEC-81). */
export interface OneTwoConfig {
  pickMs: number;
  answerMs: number;
  offerCount: number;
  /** Fewest unused answers a pass type needs to be offered; below it the offer falls back to any answer. */
  minAnswers: number;
  maxPasses: number;
  /** The pass types this battle may offer. */
  passTypes: readonly OneTwoPassType[];
  latencyGraceMs: number;
  showWrongAnswers: boolean;
  points: { rallyWin: number };
}

export type OneTwoPhase = 'PICKING' | 'ANSWERING' | 'CLOSED';
export type OneTwoMissReason = 'WRONG' | 'BURNED' | 'TIME_UP';
export type OneTwoEndReason = 'MISSED' | 'DEAD_END' | 'MAX_PASSES' | 'FORFEIT';

/** One return of the rally: the name that became the ball, the pass it answered and who returned it. */
export interface OneTwoReturn {
  entityId: string;
  passType: OneTwoPassType;
  returnedBy: ParticipantId;
}

export interface OneTwoRoundState {
  roundNo: number;
  participants: ParticipantId[];
  seedEntityId: string;
  ball: string;
  passer: ParticipantId;
  receiver: ParticipantId;
  phase: OneTwoPhase;
  deadline: Date;
  offer: OneTwoPassType[];
  passType: OneTwoPassType | null;
  chain: OneTwoReturn[];
  /** Names burned in this battle (08 §15.1 step 10): carried over from earlier rallies, the seed included. */
  used: UsedAnswers;
  endReason: OneTwoEndReason | null;
  missReason: OneTwoMissReason | null;
  points: Record<ParticipantId, number>;
}

export type OneTwoEvent =
  | {
      type: 'OFFER';
      roundNo: number;
      ball: string;
      passer: ParticipantId;
      passTypes: OneTwoPassType[];
      pickDeadlineAt: Date;
    }
  | {
      type: 'PASSED';
      roundNo: number;
      passType: OneTwoPassType;
      receiver: ParticipantId;
      answerDeadlineAt: Date;
      random: boolean;
    }
  | { type: 'RETURNED'; roundNo: number; entityId: string; passType: OneTwoPassType; participantId: ParticipantId }
  | {
      type: 'MISSED';
      roundNo: number;
      participantId: ParticipantId;
      reason: OneTwoMissReason;
      /** What the text matched; hidden for a wrong answer unless `showWrongAnswers`. */
      entityId: string | null;
    };

export type OneTwoTextAnswer = Exclude<JudgedAnswer, { number: number }>;

/**
 * `linked` is the server's verdict: the answer is a neighbour of the ball for the picked pass type. `nextAvailability`
 * is what the answered name offers as the next ball, counted by the runner without the burned names (08 §15.7).
 */
export type OneTwoCommand =
  | { type: 'ONE_TWO_PASS'; passType: OneTwoPassType }
  | { type: 'ONE_TWO_ANSWER'; answer: OneTwoTextAnswer; linked: boolean; nextAvailability: PassAvailability };

type Step = RulesStep<OneTwoRoundState, OneTwoEvent>;

export const PHASE_TIMER = 'phase';

/** وان تو for exactly two participants (08 §15). Pure: no I/O; time, randomness and link counts are passed in. */
export class OneTwoRules {
  constructor(private readonly config: OneTwoConfig) {}

  startRound(
    roundNo: number,
    participants: ParticipantId[],
    seedEntityId: string,
    passer: ParticipantId,
    burned: UsedAnswers,
    seedAvailability: PassAvailability,
    now: Date,
    random: RandomSource,
  ): Step {
    const receiver = participants.find((id) => id !== passer) ?? passer;
    const state: OneTwoRoundState = {
      roundNo,
      participants: [...participants],
      seedEntityId,
      ball: seedEntityId,
      passer,
      receiver,
      phase: 'PICKING',
      deadline: now,
      offer: [],
      passType: null,
      chain: [],
      used: addUsedAnswer(burned, seedEntityId),
      endReason: null,
      missReason: null,
      points: {},
    };
    return this.offerPasses(state, seedAvailability, now, random);
  }

  /** Checks an answer before its text is judged: right phase, right player, in time. */
  findAnswerRejection(state: OneTwoRoundState, from: ParticipantId, receivedAt: Date): Rejection | null {
    if (state.phase === 'CLOSED') return reject('ROUND_CLOSED');
    if (!state.participants.includes(from)) return reject('PARTICIPANT_FORFEITED');
    if (state.phase !== 'ANSWERING' || from !== state.receiver) return reject('NOT_YOUR_TURN');
    if (this.isLate(state, receivedAt)) return reject('ANSWER_WINDOW_CLOSED');
    return null;
  }

  handleCommand(
    state: OneTwoRoundState,
    from: ParticipantId,
    command: OneTwoCommand,
    now: Date,
    random: RandomSource,
  ): Step | Rejection {
    if (state.phase === 'CLOSED') return reject('ROUND_CLOSED');
    if (!state.participants.includes(from)) return reject('PARTICIPANT_FORFEITED');
    switch (command.type) {
      case 'ONE_TWO_PASS':
        return this.pass(state, from, command.passType, false, now);
      case 'ONE_TWO_ANSWER':
        return this.findAnswerRejection(state, from, now) ?? this.answer(state, from, command, now, random);
    }
  }

  handleTimer(state: OneTwoRoundState, timer: string, now: Date, random: RandomSource): Step {
    if (timer !== PHASE_TIMER) return { state, effects: [] };
    if (state.phase === 'PICKING') {
      const passType = state.offer[Math.floor(random.next() * state.offer.length)];
      if (passType === undefined) return { state, effects: [] };
      const step = this.pass(state, state.passer, passType, true, now);
      return 'rejected' in step ? { state, effects: [] } : step;
    }
    if (state.phase === 'ANSWERING') {
      const timedOut: RoundAction = {
        participantId: state.receiver,
        kind: 'ONE_TWO_ANSWER',
        isCorrect: false,
        points: 0,
        at: now,
      };
      const miss = this.miss(state, 'TIME_UP', null);
      return { state: miss.state, effects: [{ type: 'RECORD_ACTION', action: timedOut }, ...miss.effects] };
    }
    return { state, effects: [] };
  }

  /** The other participant gets the rally; the battle then ends on the forfeit. */
  participantLeft(state: OneTwoRoundState, who: ParticipantId): Step {
    if (state.phase === 'CLOSED' || !state.participants.includes(who)) return { state, effects: [] };
    return this.closeRound(state, state.participants.find((id) => id !== who) ?? null, 'FORFEIT');
  }

  private pass(
    state: OneTwoRoundState,
    from: ParticipantId,
    passType: OneTwoPassType,
    random: boolean,
    now: Date,
  ): Step | Rejection {
    if (state.phase !== 'PICKING' || from !== state.passer) {
      return reject(state.phase === 'ANSWERING' && from === state.passer ? 'ALREADY_PASSED' : 'NOT_YOUR_TURN');
    }
    if (!state.offer.includes(passType)) return reject('NOT_OFFERED');
    if (!random && this.isLate(state, now)) return reject('PICK_WINDOW_CLOSED');
    const answerDeadlineAt = this.after(now, this.config.answerMs);
    return {
      state: { ...state, phase: 'ANSWERING', passType, deadline: answerDeadlineAt },
      effects: [
        { type: 'CANCEL', timer: PHASE_TIMER },
        {
          type: 'RECORD_ACTION',
          action: { participantId: from, kind: 'ONE_TWO_PASS', isCorrect: !random, points: 0, at: now },
        },
        {
          type: 'EMIT',
          event: {
            type: 'PASSED',
            roundNo: state.roundNo,
            passType,
            receiver: state.receiver,
            answerDeadlineAt,
            random,
          },
        },
        this.scheduleDeadline(answerDeadlineAt),
      ],
    };
  }

  private answer(
    state: OneTwoRoundState,
    from: ParticipantId,
    command: Extract<OneTwoCommand, { type: 'ONE_TWO_ANSWER' }>,
    now: Date,
    random: RandomSource,
  ): Step {
    const entityId = command.answer.entityId;
    const reason: OneTwoMissReason | null =
      entityId === null || !command.linked ? 'WRONG' : hasAnswerBeenUsed(state.used, entityId) ? 'BURNED' : null;
    const recorded: Effect<OneTwoEvent> = {
      type: 'RECORD_ACTION',
      action: {
        participantId: from,
        kind: 'ONE_TWO_ANSWER',
        answer: command.answer,
        isCorrect: reason === null,
        points: 0,
        at: now,
      },
    };
    if (reason !== null || entityId === null || state.passType === null) {
      const miss = this.miss(state, reason ?? 'WRONG', entityId);
      return { state: miss.state, effects: [recorded, ...miss.effects] };
    }
    const returned: OneTwoRoundState = {
      ...state,
      ball: entityId,
      passer: from,
      receiver: state.passer,
      passType: null,
      chain: [...state.chain, { entityId, passType: state.passType, returnedBy: from }],
      used: addUsedAnswer(state.used, entityId),
    };
    const effects: Effect<OneTwoEvent>[] = [
      { type: 'CANCEL', timer: PHASE_TIMER },
      recorded,
      {
        type: 'EMIT',
        event: { type: 'RETURNED', roundNo: state.roundNo, entityId, passType: state.passType, participantId: from },
      },
    ];
    const next =
      returned.chain.length >= this.config.maxPasses
        ? this.closeRound(returned, null, 'MAX_PASSES')
        : this.offerPasses(returned, command.nextAvailability, now, random);
    return { state: next.state, effects: [...effects, ...next.effects] };
  }

  /**
   * Up to `offerCount` pass types at random among those with `minAnswers` unused answers, or with at least one when
   * none has that many; a dead end when the ball has no unused answer at all (08 §15.1 steps 3 and 6).
   */
  private offerPasses(state: OneTwoRoundState, availability: PassAvailability, now: Date, random: RandomSource): Step {
    const enabled = ONE_TWO_PASS_TYPES.filter((type) => this.config.passTypes.includes(type));
    const full = enabled.filter((type) => (availability[type] ?? 0) >= this.config.minAnswers);
    const candidates = full.length > 0 ? full : enabled.filter((type) => (availability[type] ?? 0) > 0);
    if (candidates.length === 0) return this.closeRound(state, null, 'DEAD_END');
    const offer = pickAtRandom(candidates, this.config.offerCount, random).sort(
      (first, second) => ONE_TWO_PASS_TYPES.indexOf(first) - ONE_TWO_PASS_TYPES.indexOf(second),
    );
    const pickDeadlineAt = this.after(now, this.config.pickMs);
    return {
      state: { ...state, phase: 'PICKING', offer, deadline: pickDeadlineAt },
      effects: [
        {
          type: 'EMIT',
          event: {
            type: 'OFFER',
            roundNo: state.roundNo,
            ball: state.ball,
            passer: state.passer,
            passTypes: offer,
            pickDeadlineAt,
          },
        },
        this.scheduleDeadline(pickDeadlineAt),
      ],
    };
  }

  private miss(state: OneTwoRoundState, reason: OneTwoMissReason, entityId: string | null): Step {
    const shown = reason === 'WRONG' && !this.config.showWrongAnswers ? null : entityId;
    const closed = this.closeRound({ ...state, missReason: reason }, state.passer, 'MISSED');
    return {
      state: closed.state,
      effects: [
        {
          type: 'EMIT',
          event: { type: 'MISSED', roundNo: state.roundNo, participantId: state.receiver, reason, entityId: shown },
        },
        ...closed.effects,
      ],
    };
  }

  private closeRound(state: OneTwoRoundState, winner: ParticipantId | null, endReason: OneTwoEndReason): Step {
    const points =
      winner !== null && endReason !== 'FORFEIT'
        ? { ...state.points, [winner]: (state.points[winner] ?? 0) + this.config.points.rallyWin }
        : state.points;
    const result: RoundResult = {
      winnerParticipantId: winner,
      endReason,
      points,
      stepsRevealed: state.chain.length,
      carryOver: { used: state.used } satisfies OneTwoCarryOver,
    };
    return {
      state: { ...state, phase: 'CLOSED', endReason, points },
      effects: [
        { type: 'CANCEL', timer: PHASE_TIMER },
        { type: 'END_ROUND', result },
      ],
    };
  }

  private isLate(state: OneTwoRoundState, receivedAt: Date): boolean {
    return receivedAt.getTime() > state.deadline.getTime() + this.config.latencyGraceMs;
  }

  private after(now: Date, ms: number): Date {
    return new Date(now.getTime() + ms);
  }

  private scheduleDeadline(deadline: Date): Effect<OneTwoEvent> {
    return { type: 'SCHEDULE', timer: PHASE_TIMER, at: this.after(deadline, this.config.latencyGraceMs) };
  }
}

/** What a rally hands to the next one: the names burned so far in the battle. */
export interface OneTwoCarryOver {
  used: UsedAnswers;
}

/** The names burned by earlier rallies, from the previous round's `carryOver` (none in round 1). */
export function readBurnedNames(carryOver: unknown): UsedAnswers {
  const used = (carryOver as Partial<OneTwoCarryOver> | undefined)?.used;
  return Array.isArray(used) ? used.filter((id): id is string => typeof id === 'string') : [];
}

/** `count` distinct items in random order (all of them when there are fewer). */
function pickAtRandom<T>(items: readonly T[], count: number, random: RandomSource): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(...pool.splice(Math.floor(random.next() * pool.length), 1));
  }
  return picked;
}
