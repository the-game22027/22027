import {
  type Effect,
  type JudgedAnswer,
  type ParticipantId,
  type Rejection,
  reject,
  type RoundResult,
  type RulesStep,
} from './game-rules';
import { findLockedUntil, lockOutAfterWrongTry, type Lockouts, noLockouts } from './shared/lockout-ladder';

/** Who wins a thread nobody finished in time (DEC-86). */
export type ThreadTimeUp = 'HIGHER_ROOM_WINS' | 'DRAW';

/** `THREAD` values of the battle config (08 §17.6). Every number is configuration (DEC-86). */
export interface ThreadConfig {
  roundMs: number;
  /** Lockout after each wrong answer; the last value repeats. */
  lockoutMs: number[];
  /** The first letter of the answer after this long in the same room. */
  hint: { afterMs: number };
  jump: { perThread: number };
  timeUp: ThreadTimeUp;
  latencyGraceMs: number;
  points: { thread: number };
}

/** Where one player is on the thread. `room` is 0-based; `roomCount` means they finished. */
export interface ThreadProgress {
  room: number;
  enteredAt: Date;
  /** Whether this room's hint is out. */
  hinted: boolean;
  /** True after `thread:jump` until the jump question is answered: the target is the next room's answer. */
  jumping: boolean;
  jumpsLeft: number;
}

export interface ThreadRoundState {
  roundNo: number;
  participants: ParticipantId[];
  roomCount: number;
  deadline: Date;
  progress: Record<ParticipantId, ThreadProgress>;
  lockouts: Lockouts;
  phase: 'OPEN' | 'CLOSED';
  winner: ParticipantId | null;
  endReason: ThreadEndReason | null;
  points: Record<ParticipantId, number>;
}

export type ThreadEndReason = 'THREAD_COMPLETE' | 'TIME_UP' | 'FORFEIT';

export type ThreadEvent =
  /** A right answer: `room` is where the player is now (`roomCount` when finished). */
  | { type: 'PROGRESSED'; roundNo: number; participantId: ParticipantId; room: number; jumped: boolean }
  | { type: 'LOCKED'; roundNo: number; participantId: ParticipantId; lockedUntil: Date }
  | { type: 'JUMPED'; roundNo: number; participantId: ParticipantId; room: number }
  /** `slot` is the answer the hint is for: the room's, or the next room's while jumping. */
  | { type: 'HINTED'; roundNo: number; participantId: ParticipantId; room: number; slot: number };

export type ThreadTextAnswer = Exclude<JudgedAnswer, { number: number }>;

/** `right` is the server's verdict against the answer of the slot `targetSlotOf` names. */
export type ThreadCommand =
  | { type: 'THREAD_ANSWER'; room: number; answer: ThreadTextAnswer; right: boolean }
  | { type: 'THREAD_JUMP'; room: number };

type Step = RulesStep<ThreadRoundState, ThreadEvent>;

export const ROUND_TIMER = 'round';
const HINT_TIMER_PREFIX = 'hint:';
export const hintTimerOf = (participantId: ParticipantId): string => `${HINT_TIMER_PREFIX}${participantId}`;

/** الخيط: both players race along the same thread at once (08 §17). Pure: no I/O; time and verdicts are passed in. */
export class ThreadRules {
  constructor(private readonly config: ThreadConfig) {}

  startRound(roundNo: number, participants: ParticipantId[], roomCount: number, now: Date): Step {
    const deadline = this.after(now, this.config.roundMs);
    const state: ThreadRoundState = {
      roundNo,
      participants: [...participants],
      roomCount,
      deadline,
      progress: Object.fromEntries(
        participants.map((id) => [
          id,
          { room: 0, enteredAt: now, hinted: false, jumping: false, jumpsLeft: this.config.jump.perThread },
        ]),
      ),
      lockouts: noLockouts(participants),
      phase: 'OPEN',
      winner: null,
      endReason: null,
      points: {},
    };
    return {
      state,
      effects: [
        { type: 'SCHEDULE', timer: ROUND_TIMER, at: this.after(deadline, this.config.latencyGraceMs) },
        ...participants.map((id) => this.scheduleHint(id, now)),
      ],
    };
  }

  /** The answer slot a player is working on: their room's, or the next room's while jumping. */
  targetSlotOf(state: ThreadRoundState, who: ParticipantId): number | null {
    const progress = state.progress[who];
    if (!progress || progress.room >= state.roomCount) return null;
    return progress.room + (progress.jumping ? 1 : 0);
  }

  /** Checks an answer before its text is judged: open round, the sender's room, in time, not locked out. */
  findAnswerRejection(state: ThreadRoundState, from: ParticipantId, room: number, receivedAt: Date): Rejection | null {
    return this.findCommonRejection(state, from, room, receivedAt) ?? this.findLockout(state, from, receivedAt);
  }

  handleCommand(state: ThreadRoundState, from: ParticipantId, command: ThreadCommand, now: Date): Step | Rejection {
    switch (command.type) {
      case 'THREAD_ANSWER':
        return this.findAnswerRejection(state, from, command.room, now) ?? this.answer(state, from, command, now);
      case 'THREAD_JUMP':
        return this.findCommonRejection(state, from, command.room, now) ?? this.jump(state, from, now);
    }
  }

  handleTimer(state: ThreadRoundState, timer: string): Step {
    if (state.phase === 'CLOSED') return { state, effects: [] };
    if (timer === ROUND_TIMER) return this.closeAtDeadline(state);
    if (!timer.startsWith(HINT_TIMER_PREFIX)) return { state, effects: [] };
    const who = timer.slice(HINT_TIMER_PREFIX.length);
    const progress = state.progress[who];
    const slot = this.targetSlotOf(state, who);
    if (!progress || progress.hinted || slot === null || !state.participants.includes(who)) {
      return { state, effects: [] };
    }
    return {
      state: { ...state, progress: { ...state.progress, [who]: { ...progress, hinted: true } } },
      effects: [
        {
          type: 'EMIT',
          event: { type: 'HINTED', roundNo: state.roundNo, participantId: who, room: progress.room, slot },
        },
      ],
    };
  }

  /** The other participant wins the thread without points; the battle then ends on the forfeit. */
  participantLeft(state: ThreadRoundState, who: ParticipantId): Step {
    if (state.phase === 'CLOSED' || !state.participants.includes(who)) return { state, effects: [] };
    return this.closeRound(state, state.participants.find((id) => id !== who) ?? null, 'FORFEIT');
  }

  /** When this player may answer again, or null; for the ack and the snapshot. */
  lockedUntilOf(state: ThreadRoundState, who: ParticipantId, now: Date): Date | null {
    return findLockedUntil(state.lockouts, who, now);
  }

  private findCommonRejection(
    state: ThreadRoundState,
    from: ParticipantId,
    room: number,
    receivedAt: Date,
  ): Rejection | null {
    if (state.phase === 'CLOSED') return reject('ROUND_CLOSED');
    if (!state.participants.includes(from)) return reject('PARTICIPANT_FORFEITED');
    if (receivedAt.getTime() > state.deadline.getTime() + this.config.latencyGraceMs) return reject('ROUND_CLOSED');
    if (state.progress[from]?.room !== room) return reject('NOT_YOUR_ROOM');
    return null;
  }

  private findLockout(state: ThreadRoundState, from: ParticipantId, now: Date): Rejection | null {
    return findLockedUntil(state.lockouts, from, now) ? reject('LOCKED_OUT') : null;
  }

  private answer(
    state: ThreadRoundState,
    from: ParticipantId,
    command: Extract<ThreadCommand, { type: 'THREAD_ANSWER' }>,
    now: Date,
  ): Step {
    const progress = state.progress[from];
    const recorded: Effect<ThreadEvent> = {
      type: 'RECORD_ACTION',
      action: {
        participantId: from,
        kind: 'THREAD_ANSWER',
        answer: command.answer,
        cell: this.targetSlotOf(state, from) ?? undefined,
        isCorrect: command.right,
        points: 0,
        at: now,
      },
    };
    if (!command.right) {
      // A wrong jump answer spends the jump (DEC-86): back to the room's own question.
      const lockouts = lockOutAfterWrongTry(state.lockouts, from, now, this.config.lockoutMs);
      const lockedUntil = lockouts[from]?.lockedUntil ?? now;
      return {
        state: { ...state, lockouts, progress: { ...state.progress, [from]: { ...progress, jumping: false } } },
        effects: [
          recorded,
          { type: 'EMIT', event: { type: 'LOCKED', roundNo: state.roundNo, participantId: from, lockedUntil } },
        ],
      };
    }
    const jumped = progress.jumping;
    const room = Math.min(progress.room + (jumped ? 2 : 1), state.roomCount);
    const moved: ThreadRoundState = {
      ...state,
      progress: { ...state.progress, [from]: { ...progress, room, enteredAt: now, hinted: false, jumping: false } },
    };
    const effects: Effect<ThreadEvent>[] = [
      recorded,
      { type: 'CANCEL', timer: hintTimerOf(from) },
      { type: 'EMIT', event: { type: 'PROGRESSED', roundNo: state.roundNo, participantId: from, room, jumped } },
    ];
    if (room >= state.roomCount) {
      const closed = this.closeRound(moved, from, 'THREAD_COMPLETE');
      return { state: closed.state, effects: [...effects, ...closed.effects] };
    }
    return { state: moved, effects: [...effects, this.scheduleHint(from, now)] };
  }

  private jump(state: ThreadRoundState, from: ParticipantId, now: Date): Step | Rejection {
    const progress = state.progress[from];
    if (progress.jumping) return reject('JUMP_NOT_ALLOWED');
    if (progress.jumpsLeft <= 0) return reject('NO_JUMP_LEFT');
    // The jump folds this room and the next into one question, so the last room has none.
    if (progress.room >= state.roomCount - 1) return reject('JUMP_NOT_ALLOWED');
    return {
      state: {
        ...state,
        progress: {
          ...state.progress,
          [from]: { ...progress, jumping: true, jumpsLeft: progress.jumpsLeft - 1 },
        },
      },
      effects: [
        {
          type: 'RECORD_ACTION',
          action: { participantId: from, kind: 'THREAD_JUMP', cell: progress.room, points: 0, at: now },
        },
        { type: 'EMIT', event: { type: 'JUMPED', roundNo: state.roundNo, participantId: from, room: progress.room } },
      ],
    };
  }

  /** Nobody finished: the player further along wins, or nobody (DEC-86). */
  private closeAtDeadline(state: ThreadRoundState): Step {
    const rooms = state.participants.map((id) => state.progress[id]?.room ?? 0);
    const furthest = Math.max(...rooms);
    const leaders = state.participants.filter((_, index) => rooms[index] === furthest);
    const winner = this.config.timeUp === 'HIGHER_ROOM_WINS' && leaders.length === 1 ? leaders[0] : null;
    return this.closeRound(state, winner, 'TIME_UP');
  }

  private closeRound(state: ThreadRoundState, winner: ParticipantId | null, endReason: ThreadEndReason): Step {
    const points =
      winner !== null && endReason !== 'FORFEIT'
        ? { ...state.points, [winner]: (state.points[winner] ?? 0) + this.config.points.thread }
        : state.points;
    const result: RoundResult = {
      winnerParticipantId: winner,
      endReason,
      points,
      stepsRevealed: Math.max(...state.participants.map((id) => state.progress[id]?.room ?? 0)),
    };
    return {
      state: { ...state, phase: 'CLOSED', winner, endReason, points },
      effects: [
        { type: 'CANCEL', timer: ROUND_TIMER },
        ...state.participants.map((id): Effect<ThreadEvent> => ({ type: 'CANCEL', timer: hintTimerOf(id) })),
        { type: 'END_ROUND', result },
      ],
    };
  }

  private scheduleHint(participantId: ParticipantId, enteredAt: Date): Effect<ThreadEvent> {
    return { type: 'SCHEDULE', timer: hintTimerOf(participantId), at: this.after(enteredAt, this.config.hint.afterMs) };
  }

  private after(now: Date, ms: number): Date {
    return new Date(now.getTime() + ms);
  }
}
