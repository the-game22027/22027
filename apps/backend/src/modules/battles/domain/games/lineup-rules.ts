import {
  type Effect,
  type ParticipantId,
  type Rejection,
  reject,
  type RoundResult,
  type RulesStep,
} from './game-rules';
import { findNextHintAt, type HintSchedule } from './shared/hint-schedule';
import { findLockedUntil, lockOutAfterWrongTry, type Lockouts, noLockouts } from './shared/lockout-ladder';
import { addUsedAnswer, hasAnswerBeenUsed, type UsedAnswers } from './shared/used-answers';

/** `LINEUP` values of the battle config (08 §14.6). Every number is configuration. */
export interface LineupConfig {
  roundMs: number;
  /** DEC-80: lockout after each wrong name; the last value repeats. */
  lockoutMs: number[];
  /** When the first letters of the empty slots come out. */
  hints: HintSchedule;
  /** DEC-80: accusations per player per round. */
  accuse: { perPlayer: number };
  /** DEC-60: the opponent sees which player a wrong name matched. */
  showWrongAnswers: boolean;
  latencyGraceMs: number;
  points: { correct: number; captain: number; accuseRight: number; accuseWrong: number };
}

export interface LineupSlotState {
  playerEntityId: string;
  captain: boolean;
  /** Placed: by a participant, or by nobody (null) for a real shown name after the fake was unmasked. */
  placed: boolean;
  placedBy: ParticipantId | null;
}

export interface LineupRoundState {
  roundNo: number;
  participants: ParticipantId[];
  startedAt: Date;
  deadline: Date;
  slots: LineupSlotState[];
  shownEntityIds: string[];
  fakeEntityId: string;
  fakeUnmaskedBy: ParticipantId | null;
  accusationsUsed: Record<ParticipantId, number>;
  /** Wrong names per player (entity id, or the typed text when it named nobody): a repeat costs nothing. */
  wrongNames: Record<ParticipantId, UsedAnswers>;
  lockouts: Lockouts;
  hintsGiven: number;
  phase: 'OPEN' | 'CLOSED';
  points: Record<ParticipantId, number>;
}

export type LineupEvent =
  | { type: 'ROUND_STARTED'; roundNo: number; roundDeadlineAt: Date; hintsAt: Date | null }
  | { type: 'PLACED'; roundNo: number; slot: number; entityId: string; participantId: ParticipantId | null }
  | { type: 'WRONG'; roundNo: number; participantId: ParticipantId; entityId: string | null; lockedUntil: Date }
  | { type: 'ACCUSED'; roundNo: number; participantId: ParticipantId; right: boolean; entityId: string | null }
  | { type: 'HINTS'; roundNo: number; slots: number[] };

/** `answer.entityId` is the server's match for the typed text among the XI and the fake, or null. */
export type LineupCommand = { type: 'LINEUP_ANSWER'; answer: { entityId: string | null; text?: string } };

/** What a typed name did, for the player's own ack (08 §14.3). */
export type LineupAnswerResult = 'PLACED' | 'WRONG' | 'ACCUSED_RIGHT' | 'ACCUSED_WRONG';

type Step = RulesStep<LineupRoundState, LineupEvent>;

export const ROUND_TIMER = 'round';
export const HINT_TIMER = 'hint';

/**
 * التشكيلة: everyone fills the same XI at once; the first right name takes a slot (08 §14). Pure: no I/O; time is
 * passed in.
 */
export class LineupRules {
  constructor(private readonly config: LineupConfig) {}

  startRound(input: {
    roundNo: number;
    participants: ParticipantId[];
    slots: { playerEntityId: string; captain: boolean }[];
    shownEntityIds: string[];
    fakeEntityId: string;
    now: Date;
  }): Step {
    const { roundNo, participants, now } = input;
    const roundDeadlineAt = this.after(now, this.config.roundMs);
    const state: LineupRoundState = {
      roundNo,
      participants: [...participants],
      startedAt: now,
      deadline: roundDeadlineAt,
      slots: input.slots.map((slot) => ({ ...slot, placed: false, placedBy: null })),
      shownEntityIds: [...input.shownEntityIds],
      fakeEntityId: input.fakeEntityId,
      fakeUnmaskedBy: null,
      accusationsUsed: Object.fromEntries(participants.map((id) => [id, 0])),
      wrongNames: Object.fromEntries(participants.map((id) => [id, []])),
      lockouts: noLockouts(participants),
      hintsGiven: 0,
      phase: 'OPEN',
      points: {},
    };
    const hintsAt = this.findNextHintAt(state);
    return {
      state,
      effects: [
        { type: 'EMIT', event: { type: 'ROUND_STARTED', roundNo, roundDeadlineAt, hintsAt } },
        { type: 'SCHEDULE', timer: ROUND_TIMER, at: this.after(roundDeadlineAt, this.config.latencyGraceMs) },
        ...(hintsAt ? [{ type: 'SCHEDULE', timer: HINT_TIMER, at: hintsAt } as const] : []),
      ],
    };
  }

  handleCommand(state: LineupRoundState, from: ParticipantId, command: LineupCommand, now: Date): Step | Rejection {
    if (state.phase === 'CLOSED') return reject('ROUND_CLOSED');
    if (!state.participants.includes(from)) return reject('PARTICIPANT_FORFEITED');
    if (now.getTime() > state.deadline.getTime() + this.config.latencyGraceMs) return reject('ROUND_CLOSED');
    if (findLockedUntil(state.lockouts, from, now)) return reject('LOCKED_OUT');
    const entityId = command.answer.entityId;
    if (entityId !== null && this.isAccusation(state, entityId)) return this.accuse(state, from, command, now);
    const slot = entityId === null ? -1 : state.slots.findIndex((candidate) => candidate.playerEntityId === entityId);
    if (slot >= 0) {
      if (state.slots[slot]?.placed) return reject('ALREADY_TAKEN');
      return this.place(state, from, command, slot, now);
    }
    if (entityId !== null && entityId === state.fakeEntityId) return reject('ALREADY_TAKEN');
    return this.wrongName(state, from, command, now);
  }

  handleTimer(state: LineupRoundState, timer: string): Step {
    if (state.phase === 'CLOSED') return { state, effects: [] };
    if (timer === ROUND_TIMER) return this.closeRound(state, 'TIME_UP');
    if (timer !== HINT_TIMER || this.findNextHintAt(state) === null) return { state, effects: [] };
    const hinted: LineupRoundState = { ...state, hintsGiven: state.hintsGiven + 1 };
    const next = this.findNextHintAt(hinted);
    return {
      state: hinted,
      effects: [
        { type: 'EMIT', event: { type: 'HINTS', roundNo: state.roundNo, slots: this.findEmptySlots(state) } },
        ...(next ? [{ type: 'SCHEDULE', timer: HINT_TIMER, at: next } as const] : []),
      ],
    };
  }

  /** The battle then ends on the forfeit; the round closes with the points earned so far. */
  participantLeft(state: LineupRoundState, who: ParticipantId): Step {
    if (state.phase === 'CLOSED' || !state.participants.includes(who)) return { state, effects: [] };
    return this.closeRound(state, 'FORFEIT', state.participants.find((id) => id !== who) ?? null);
  }

  /** What the player's last accepted name did, read from the step's effects: for the private ack. */
  findAnswerResult(effects: readonly Effect<LineupEvent>[], from: ParticipantId): LineupAnswerResult | null {
    for (const effect of effects) {
      if (effect.type !== 'EMIT') continue;
      const { event } = effect;
      if (event.type === 'PLACED' && event.participantId === from) return 'PLACED';
      if (event.type === 'WRONG' && event.participantId === from) return 'WRONG';
      if (event.type === 'ACCUSED' && event.participantId === from)
        return event.right ? 'ACCUSED_RIGHT' : 'ACCUSED_WRONG';
    }
    return null;
  }

  /** When this player may type again, or null; for the ack and the snapshot. */
  lockedUntilOf(state: LineupRoundState, who: ParticipantId, now: Date): Date | null {
    return findLockedUntil(state.lockouts, who, now);
  }

  /** Slots whose name is not on the board yet, in slot order. */
  findEmptySlots(state: LineupRoundState): number[] {
    return state.slots.flatMap((slot, index) => (slot.placed ? [] : [index]));
  }

  /** The next wave of first-letter hints, or null when every wave is out or it would come after the round ends. */
  findNextHintAt(state: LineupRoundState): Date | null {
    const at = findNextHintAt(state.startedAt, this.config.hints, state.hintsGiven);
    return at && at.getTime() < state.deadline.getTime() ? at : null;
  }

  /** A shown name, while the fake is not found yet. After that every shown name is on the board or crossed out. */
  private isAccusation(state: LineupRoundState, entityId: string): boolean {
    return state.fakeUnmaskedBy === null && state.shownEntityIds.includes(entityId);
  }

  private accuse(state: LineupRoundState, from: ParticipantId, command: LineupCommand, now: Date): Step | Rejection {
    if ((state.accusationsUsed[from] ?? 0) >= this.config.accuse.perPlayer) return reject('ACCUSATION_USED');
    const right = command.answer.entityId === state.fakeEntityId;
    const points = right ? this.config.points.accuseRight : this.config.points.accuseWrong;
    const accused: LineupRoundState = {
      ...state,
      accusationsUsed: { ...state.accusationsUsed, [from]: (state.accusationsUsed[from] ?? 0) + 1 },
      points: this.addPoints(state.points, from, points),
    };
    const effects: Effect<LineupEvent>[] = [
      this.record(from, 'LINEUP_ACCUSE', command, right, points, now),
      {
        type: 'EMIT',
        // A wrong accusation does not name the shown player: that would tell the opponent he is real (08 §14.2).
        event: {
          type: 'ACCUSED',
          roundNo: state.roundNo,
          participantId: from,
          right,
          entityId: right ? state.fakeEntityId : null,
        },
      },
    ];
    if (!right) return { state: accused, effects };
    // The fake is found: the real shown names go on the board for nobody.
    let unmasked: LineupRoundState = { ...accused, fakeUnmaskedBy: from };
    for (const shown of state.shownEntityIds) {
      const slot = unmasked.slots.findIndex((candidate) => candidate.playerEntityId === shown);
      if (slot < 0 || unmasked.slots[slot]?.placed) continue;
      unmasked = this.withSlotPlaced(unmasked, slot, null);
      effects.push({
        type: 'EMIT',
        event: { type: 'PLACED', roundNo: state.roundNo, slot, entityId: shown, participantId: null },
      });
    }
    return this.closeIfComplete(unmasked, effects);
  }

  private place(state: LineupRoundState, from: ParticipantId, command: LineupCommand, slot: number, now: Date): Step {
    const target = state.slots[slot];
    const points = target?.captain ? this.config.points.captain : this.config.points.correct;
    const placed = { ...this.withSlotPlaced(state, slot, from), points: this.addPoints(state.points, from, points) };
    const effects: Effect<LineupEvent>[] = [
      this.record(from, 'LINEUP_ANSWER', command, true, points, now),
      {
        type: 'EMIT',
        event: {
          type: 'PLACED',
          roundNo: state.roundNo,
          slot,
          entityId: target?.playerEntityId ?? '',
          participantId: from,
        },
      },
    ];
    return this.closeIfComplete(placed, effects);
  }

  private wrongName(state: LineupRoundState, from: ParticipantId, command: LineupCommand, now: Date): Step | Rejection {
    const name = command.answer.entityId ?? (command.answer.text ?? '').trim().toLowerCase();
    if (hasAnswerBeenUsed(state.wrongNames[from] ?? [], name)) return reject('ALREADY_TRIED');
    const lockouts = lockOutAfterWrongTry(state.lockouts, from, now, this.config.lockoutMs);
    return {
      state: {
        ...state,
        lockouts,
        wrongNames: { ...state.wrongNames, [from]: addUsedAnswer(state.wrongNames[from] ?? [], name) },
      },
      effects: [
        this.record(from, 'LINEUP_ANSWER', command, false, 0, now),
        {
          type: 'EMIT',
          event: {
            type: 'WRONG',
            roundNo: state.roundNo,
            participantId: from,
            entityId: this.config.showWrongAnswers ? command.answer.entityId : null,
            lockedUntil: findLockedUntil(lockouts, from, now) ?? now,
          },
        },
      ],
    };
  }

  /** Every slot that can be typed is taken: the ones not shown, or all of them once the fake is found. */
  private closeIfComplete(state: LineupRoundState, effects: Effect<LineupEvent>[]): Step {
    const complete = state.slots.every(
      (slot) => slot.placed || (state.fakeUnmaskedBy === null && state.shownEntityIds.includes(slot.playerEntityId)),
    );
    if (!complete) return { state, effects };
    const closed = this.closeRound(state, 'LINEUP_COMPLETE');
    return { state: closed.state, effects: [...effects, ...closed.effects] };
  }

  private closeRound(
    state: LineupRoundState,
    endReason: RoundResult['endReason'],
    forfeitWinner: ParticipantId | null = null,
  ): Step {
    return {
      state: { ...state, phase: 'CLOSED' },
      effects: [
        { type: 'CANCEL', timer: ROUND_TIMER },
        { type: 'CANCEL', timer: HINT_TIMER },
        {
          type: 'END_ROUND',
          result: {
            winnerParticipantId: endReason === 'FORFEIT' ? forfeitWinner : this.findRoundLeader(state),
            endReason,
            points: state.points,
            stepsRevealed: state.slots.filter((slot) => slot.placed).length,
          },
        },
      ],
    };
  }

  /** The participant with the most points this round, or null on a tie or when nobody scored. */
  private findRoundLeader(state: LineupRoundState): ParticipantId | null {
    const ranked = state.participants
      .map((id) => ({ id, points: state.points[id] ?? 0 }))
      .sort((a, b) => b.points - a.points);
    const [first, second] = ranked;
    if (!first || first.points <= 0 || (second && second.points === first.points)) return null;
    return first.id;
  }

  private withSlotPlaced(state: LineupRoundState, slot: number, by: ParticipantId | null): LineupRoundState {
    return {
      ...state,
      slots: state.slots.map((candidate, index) =>
        index === slot ? { ...candidate, placed: true, placedBy: by } : candidate,
      ),
    };
  }

  private addPoints(
    points: Record<ParticipantId, number>,
    who: ParticipantId,
    amount: number,
  ): Record<ParticipantId, number> {
    return { ...points, [who]: (points[who] ?? 0) + amount };
  }

  private record(
    from: ParticipantId,
    kind: 'LINEUP_ANSWER' | 'LINEUP_ACCUSE',
    command: LineupCommand,
    isCorrect: boolean,
    points: number,
    at: Date,
  ): Effect<LineupEvent> {
    return {
      type: 'RECORD_ACTION',
      action: { participantId: from, kind, answer: command.answer, isCorrect, points, at },
    };
  }

  private after(now: Date, ms: number): Date {
    return new Date(now.getTime() + ms);
  }
}
