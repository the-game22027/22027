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

/** `AUCTION` values of the battle config (08 §11.6). Every number is configuration. */
export interface AuctionConfig {
  pickMs: number;
  bidTurnMs: number;
  /** DEC-76: the lowest opening bid. */
  minOpeningBid: number;
  proofMs: number;
  proofMaxWrong: number;
  /** DEC-77: wrong names an all-in may have. */
  allInMaxWrong: number;
  stealMs: number;
  /** DEC-76: names a steal needs. */
  stealNames: number;
  latencyGraceMs: number;
  showWrongAnswers: boolean;
  points: { roundWin: number; allInWin: number };
}

export type AuctionPhase = 'PICKING' | 'BIDDING' | 'PROVING' | 'STEALING' | 'CLOSED';
export type ProofReason = 'CALL' | 'ALL_IN' | 'TIMEOUT';
export type AuctionAnswerOutcome = 'CORRECT' | 'WRONG' | 'REPEATED';
export type AuctionRoundOutcome = 'PROVED' | 'STOLEN' | 'BUST' | 'FORFEIT';

export interface AuctionBid {
  participantId: ParticipantId;
  amount: number;
}

export interface AuctionRoundState {
  roundNo: number;
  participants: ParticipantId[];
  /** How many names each of the 3 lists has. */
  listSizes: number[];
  picker: ParticipantId;
  phase: AuctionPhase;
  deadline: Date;
  pickedList: number | null;
  bids: AuctionBid[];
  turnOf: ParticipantId;
  prover: ParticipantId | null;
  amount: number;
  allIn: boolean;
  found: number;
  strikes: number;
  stealer: ParticipantId | null;
  stolen: number;
  /** Names said correctly this round, by anyone. */
  used: UsedAnswers;
  /** Entity id → who said it, for the reveal. */
  saidBy: Record<string, ParticipantId>;
  outcome: AuctionRoundOutcome | null;
  points: Record<ParticipantId, number>;
}

export type AuctionEvent =
  | { type: 'ROUND_STARTED'; roundNo: number; picker: ParticipantId; pickDeadlineAt: Date }
  | { type: 'PICKED'; roundNo: number; list: number; auto: boolean }
  | {
      type: 'TURN';
      roundNo: number;
      participantId: ParticipantId;
      currentBid: number | null;
      currentBidderId: ParticipantId | null;
      turnDeadlineAt: Date;
    }
  | { type: 'BID'; roundNo: number; participantId: ParticipantId; amount: number; allIn: boolean }
  | {
      type: 'PROOF';
      roundNo: number;
      prover: ParticipantId;
      amount: number;
      maxWrong: number;
      proofDeadlineAt: Date;
      reason: ProofReason;
    }
  | {
      type: 'ANSWERED';
      roundNo: number;
      participantId: ParticipantId;
      phase: 'PROOF' | 'STEAL';
      outcome: AuctionAnswerOutcome;
      /** Hidden for a wrong name unless `showWrongAnswers`. */
      entityId: string | null;
      found: number;
      strikes: number;
    }
  | { type: 'STEAL'; roundNo: number; stealer: ParticipantId; names: number; stealDeadlineAt: Date };

export type AuctionTextAnswer = Exclude<JudgedAnswer, { number: number }>;

/** `inList` is the server's verdict on the typed text against the picked list (08 §5.3). */
export type AuctionCommand =
  | { type: 'AUCTION_PICK'; list: number }
  | { type: 'AUCTION_BID'; amount: number }
  | { type: 'AUCTION_CALL' }
  | { type: 'AUCTION_ANSWER'; answer: AuctionTextAnswer; inList: boolean };

type Step = RulesStep<AuctionRoundState, AuctionEvent>;

export const PHASE_TIMER = 'phase';

/** المزاد for exactly two participants (08 §11). Pure: no I/O; time and randomness are passed in. */
export class AuctionRules {
  constructor(private readonly config: AuctionConfig) {}

  startRound(
    roundNo: number,
    participants: ParticipantId[],
    listSizes: number[],
    picker: ParticipantId,
    now: Date,
  ): Step {
    const pickDeadlineAt = this.after(now, this.config.pickMs);
    const state: AuctionRoundState = {
      roundNo,
      participants: [...participants],
      listSizes: [...listSizes],
      picker,
      phase: 'PICKING',
      deadline: pickDeadlineAt,
      pickedList: null,
      bids: [],
      turnOf: picker,
      prover: null,
      amount: 0,
      allIn: false,
      found: 0,
      strikes: 0,
      stealer: null,
      stolen: 0,
      used: [],
      saidBy: {},
      outcome: null,
      points: {},
    };
    return {
      state,
      effects: [
        { type: 'EMIT', event: { type: 'ROUND_STARTED', roundNo, picker, pickDeadlineAt } },
        this.scheduleDeadline(pickDeadlineAt),
      ],
    };
  }

  /** Checks an answer before its text is judged: right phase, right player, in time. */
  findAnswerRejection(state: AuctionRoundState, from: ParticipantId, receivedAt: Date): Rejection | null {
    if (state.phase === 'CLOSED') return reject('ROUND_CLOSED');
    if (!state.participants.includes(from)) return reject('PARTICIPANT_FORFEITED');
    const answerer = state.phase === 'PROVING' ? state.prover : state.phase === 'STEALING' ? state.stealer : null;
    if (answerer !== from) return reject('NOT_YOUR_TURN');
    if (this.isLate(state, receivedAt)) return reject('ANSWER_WINDOW_CLOSED');
    return null;
  }

  handleCommand(state: AuctionRoundState, from: ParticipantId, command: AuctionCommand, now: Date): Step | Rejection {
    if (state.phase === 'CLOSED') return reject('ROUND_CLOSED');
    if (!state.participants.includes(from)) return reject('PARTICIPANT_FORFEITED');
    switch (command.type) {
      case 'AUCTION_PICK':
        return this.pick(state, from, command.list, false, now);
      case 'AUCTION_BID':
        return this.bid(state, from, command.amount, now);
      case 'AUCTION_CALL':
        return this.call(state, from, now);
      case 'AUCTION_ANSWER':
        return this.findAnswerRejection(state, from, now) ?? this.answer(state, from, command, now);
    }
  }

  handleTimer(state: AuctionRoundState, timer: string, now: Date, random: RandomSource): Step {
    if (timer !== PHASE_TIMER) return { state, effects: [] };
    switch (state.phase) {
      case 'PICKING': {
        const list = Math.floor(random.next() * state.listSizes.length);
        const picked = this.pick(state, state.picker, list, true, now);
        return isRejectionStep(picked) ? { state, effects: [] } : picked;
      }
      case 'BIDDING': {
        const timedOut: RoundAction = { participantId: state.turnOf, kind: 'TURN_TIMEOUT', points: 0, at: now };
        if (state.bids.length === 0) {
          const opening = Math.min(this.config.minOpeningBid, this.pickedSize(state));
          const step = this.placeBid(state, state.turnOf, opening, now);
          return { state: step.state, effects: [{ type: 'RECORD_ACTION', action: timedOut }, ...step.effects] };
        }
        const step = this.startProof(state, 'TIMEOUT', now);
        return { state: step.state, effects: [{ type: 'RECORD_ACTION', action: timedOut }, ...step.effects] };
      }
      case 'PROVING':
        return this.startSteal(state, now);
      case 'STEALING':
        return this.closeRound(state, null, 'BUST');
      default:
        return { state, effects: [] };
    }
  }

  /** The other participant gets the round; the battle then ends on the forfeit. */
  participantLeft(state: AuctionRoundState, who: ParticipantId): Step {
    if (state.phase === 'CLOSED' || !state.participants.includes(who)) return { state, effects: [] };
    return this.closeRound(state, this.otherThan(state, who), 'FORFEIT');
  }

  /** How many wrong names the current proof may have. */
  maxWrongOf(state: AuctionRoundState): number {
    return state.allIn ? this.config.allInMaxWrong : this.config.proofMaxWrong;
  }

  private pick(
    state: AuctionRoundState,
    from: ParticipantId,
    list: number,
    auto: boolean,
    now: Date,
  ): Step | Rejection {
    if (state.phase !== 'PICKING' || from !== state.picker) return reject('NOT_YOUR_PICK');
    if (!Number.isInteger(list) || list < 0 || list >= state.listSizes.length) return reject('INVALID_LIST');
    if (!auto && this.isLate(state, now)) return reject('PICK_WINDOW_CLOSED');
    const picked: AuctionRoundState = { ...state, pickedList: list, phase: 'BIDDING' };
    const action: RoundAction = { participantId: from, kind: 'AUCTION_PICK', isCorrect: !auto, points: 0, at: now };
    const turn = this.beginTurn(picked, state.picker, now);
    return {
      state: turn.state,
      effects: [
        { type: 'CANCEL', timer: PHASE_TIMER },
        { type: 'RECORD_ACTION', action },
        { type: 'EMIT', event: { type: 'PICKED', roundNo: state.roundNo, list, auto } },
        ...turn.effects,
      ],
    };
  }

  private bid(state: AuctionRoundState, from: ParticipantId, amount: number, now: Date): Step | Rejection {
    const turnProblem = this.findBiddingTurnRejection(state, from, now);
    if (turnProblem) return turnProblem;
    const current = state.bids.at(-1)?.amount ?? null;
    const lowest = current === null ? this.config.minOpeningBid : current + 1;
    if (!Number.isInteger(amount) || amount < lowest) return reject('BID_TOO_LOW');
    if (amount > this.pickedSize(state)) return reject('BID_TOO_HIGH');
    return this.placeBid(state, from, amount, now);
  }

  private placeBid(state: AuctionRoundState, from: ParticipantId, amount: number, now: Date): Step {
    const allIn = amount === this.pickedSize(state);
    const withBid: AuctionRoundState = { ...state, bids: [...state.bids, { participantId: from, amount }] };
    const effects: Effect<AuctionEvent>[] = [
      { type: 'CANCEL', timer: PHASE_TIMER },
      { type: 'RECORD_ACTION', action: { participantId: from, kind: 'AUCTION_BID', points: 0, at: now } },
      { type: 'EMIT', event: { type: 'BID', roundNo: state.roundNo, participantId: from, amount, allIn } },
    ];
    const next = allIn
      ? this.startProof(withBid, 'ALL_IN', now)
      : this.beginTurn(withBid, this.otherThan(state, from) ?? from, now);
    return { state: next.state, effects: [...effects, ...next.effects] };
  }

  private call(state: AuctionRoundState, from: ParticipantId, now: Date): Step | Rejection {
    const turnProblem = this.findBiddingTurnRejection(state, from, now);
    if (turnProblem) return turnProblem;
    if (state.bids.length === 0) return reject('NOTHING_TO_CALL');
    const proof = this.startProof(state, 'CALL', now);
    return {
      state: proof.state,
      effects: [
        { type: 'RECORD_ACTION', action: { participantId: from, kind: 'AUCTION_CALL', points: 0, at: now } },
        ...proof.effects,
      ],
    };
  }

  private startProof(state: AuctionRoundState, reason: ProofReason, now: Date): Step {
    const last = state.bids.at(-1);
    if (!last) return { state, effects: [] };
    const proofDeadlineAt = this.after(now, this.config.proofMs);
    const allIn = last.amount === this.pickedSize(state);
    const proving: AuctionRoundState = {
      ...state,
      phase: 'PROVING',
      prover: last.participantId,
      amount: last.amount,
      allIn,
      deadline: proofDeadlineAt,
    };
    return {
      state: proving,
      effects: [
        { type: 'CANCEL', timer: PHASE_TIMER },
        {
          type: 'EMIT',
          event: {
            type: 'PROOF',
            roundNo: state.roundNo,
            prover: last.participantId,
            amount: last.amount,
            maxWrong: this.maxWrongOf(proving),
            proofDeadlineAt,
            reason,
          },
        },
        this.scheduleDeadline(proofDeadlineAt),
      ],
    };
  }

  private answer(
    state: AuctionRoundState,
    from: ParticipantId,
    command: Extract<AuctionCommand, { type: 'AUCTION_ANSWER' }>,
    now: Date,
  ): Step {
    const entityId = command.inList ? command.answer.entityId : null;
    const outcome: AuctionAnswerOutcome =
      entityId === null ? 'WRONG' : hasAnswerBeenUsed(state.used, entityId) ? 'REPEATED' : 'CORRECT';
    const stealing = state.phase === 'STEALING';
    const correct = outcome === 'CORRECT' && entityId !== null;
    const next: AuctionRoundState = {
      ...state,
      used: correct ? addUsedAnswer(state.used, entityId) : state.used,
      saidBy: correct ? { ...state.saidBy, [entityId]: from } : state.saidBy,
      found: !stealing && correct ? state.found + 1 : state.found,
      strikes: !stealing && !correct ? state.strikes + 1 : state.strikes,
      stolen: stealing && correct ? state.stolen + 1 : state.stolen,
    };
    const shown = outcome === 'WRONG' && !this.config.showWrongAnswers ? null : command.answer.entityId;
    const effects: Effect<AuctionEvent>[] = [
      {
        type: 'RECORD_ACTION',
        action: {
          participantId: from,
          kind: stealing ? 'AUCTION_STEAL' : 'AUCTION_ANSWER',
          answer: command.answer,
          isCorrect: correct,
          points: 0,
          at: now,
        },
      },
      {
        type: 'EMIT',
        event: {
          type: 'ANSWERED',
          roundNo: state.roundNo,
          participantId: from,
          phase: stealing ? 'STEAL' : 'PROOF',
          outcome,
          entityId: shown,
          found: stealing ? next.stolen : next.found,
          strikes: next.strikes,
        },
      },
    ];
    let after: Step;
    if (stealing) {
      if (!correct) after = this.closeRound(next, null, 'BUST');
      else if (next.stolen >= this.config.stealNames) after = this.closeRound(next, from, 'STOLEN');
      else after = { state: next, effects: [] };
    } else if (next.found >= next.amount) {
      after = this.closeRound(next, from, 'PROVED');
    } else if (next.strikes >= this.maxWrongOf(next)) {
      after = this.startSteal(next, now);
    } else {
      after = { state: next, effects: [] };
    }
    return { state: after.state, effects: [...effects, ...after.effects] };
  }

  private startSteal(state: AuctionRoundState, now: Date): Step {
    const stealer = state.prover ? this.otherThan(state, state.prover) : null;
    if (!stealer) return this.closeRound(state, null, 'BUST');
    const stealDeadlineAt = this.after(now, this.config.stealMs);
    return {
      state: { ...state, phase: 'STEALING', stealer, deadline: stealDeadlineAt },
      effects: [
        { type: 'CANCEL', timer: PHASE_TIMER },
        {
          type: 'EMIT',
          event: { type: 'STEAL', roundNo: state.roundNo, stealer, names: this.config.stealNames, stealDeadlineAt },
        },
        this.scheduleDeadline(stealDeadlineAt),
      ],
    };
  }

  private beginTurn(state: AuctionRoundState, participant: ParticipantId, now: Date): Step {
    const turnDeadlineAt = this.after(now, this.config.bidTurnMs);
    const last = state.bids.at(-1) ?? null;
    return {
      state: { ...state, turnOf: participant, deadline: turnDeadlineAt },
      effects: [
        {
          type: 'EMIT',
          event: {
            type: 'TURN',
            roundNo: state.roundNo,
            participantId: participant,
            currentBid: last?.amount ?? null,
            currentBidderId: last?.participantId ?? null,
            turnDeadlineAt,
          },
        },
        this.scheduleDeadline(turnDeadlineAt),
      ],
    };
  }

  private findBiddingTurnRejection(state: AuctionRoundState, from: ParticipantId, now: Date): Rejection | null {
    if (state.phase !== 'BIDDING' || state.turnOf !== from) return reject('NOT_YOUR_TURN');
    if (this.isLate(state, now)) return reject('TURN_CLOSED');
    return null;
  }

  private closeRound(state: AuctionRoundState, winner: ParticipantId | null, outcome: AuctionRoundOutcome): Step {
    const worth = outcome === 'PROVED' && state.allIn ? this.config.points.allInWin : this.config.points.roundWin;
    const points =
      winner !== null && outcome !== 'FORFEIT'
        ? { ...state.points, [winner]: (state.points[winner] ?? 0) + worth }
        : state.points;
    const endReason: RoundResult['endReason'] = outcome;
    return {
      state: { ...state, phase: 'CLOSED', outcome, points },
      effects: [
        { type: 'CANCEL', timer: PHASE_TIMER },
        {
          type: 'END_ROUND',
          result: { winnerParticipantId: winner, endReason, points, stepsRevealed: state.used.length },
        },
      ],
    };
  }

  private pickedSize(state: AuctionRoundState): number {
    return state.pickedList === null ? 0 : (state.listSizes[state.pickedList] ?? 0);
  }

  private otherThan(state: AuctionRoundState, who: ParticipantId): ParticipantId | null {
    return state.participants.find((id) => id !== who) ?? null;
  }

  private isLate(state: AuctionRoundState, receivedAt: Date): boolean {
    return receivedAt.getTime() > state.deadline.getTime() + this.config.latencyGraceMs;
  }

  private after(now: Date, ms: number): Date {
    return new Date(now.getTime() + ms);
  }

  private scheduleDeadline(deadline: Date): Effect<AuctionEvent> {
    return { type: 'SCHEDULE', timer: PHASE_TIMER, at: this.after(deadline, this.config.latencyGraceMs) };
  }
}

function isRejectionStep(value: Step | Rejection): value is Rejection {
  return (value as Rejection).rejected === true;
}
