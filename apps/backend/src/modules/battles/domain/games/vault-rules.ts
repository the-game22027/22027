import type { RandomSource } from '../random-source';
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

/** `VAULT` values of the battle config (08 §12.6). Every number is configuration. */
export interface VaultConfig {
  roundMs: number;
  /** Lockout after each wrong try; the last value repeats. */
  lockoutMs: number[];
  /** DEC-78: when digits leak, and how many at most. */
  leaks: HintSchedule;
  latencyGraceMs: number;
  points: { vaultOpened: number };
}

export interface VaultRoundState {
  roundNo: number;
  participants: ParticipantId[];
  /** The digits of the code, in question order. Never sent before a leak or the reveal. */
  code: readonly number[];
  startedAt: Date;
  deadline: Date;
  /** Positions of leaked digits, in the order they leaked. */
  leaked: number[];
  lockouts: Lockouts;
  tries: Record<ParticipantId, number>;
  phase: 'OPEN' | 'CLOSED';
  openedBy: ParticipantId | null;
  points: Record<ParticipantId, number>;
}

export type VaultEvent =
  | { type: 'ROUND_STARTED'; roundNo: number; digits: number; roundDeadlineAt: Date; firstLeakAt: Date | null }
  | { type: 'TRIED'; roundNo: number; participantId: ParticipantId; tries: number }
  | { type: 'LEAKED'; roundNo: number; position: number; digit: number; nextLeakAt: Date | null };

export type VaultCommand = { type: 'VAULT_TRY'; code: string };

type Step = RulesStep<VaultRoundState, VaultEvent>;

export const ROUND_TIMER = 'round';
export const LEAK_TIMER = 'leak';

/** الخزنة: everyone races on the same code at once (08 §12). Pure: no I/O; time and randomness are passed in. */
export class VaultRules {
  constructor(private readonly config: VaultConfig) {}

  startRound(roundNo: number, participants: ParticipantId[], code: readonly number[], now: Date): Step {
    const roundDeadlineAt = this.after(now, this.config.roundMs);
    const state: VaultRoundState = {
      roundNo,
      participants: [...participants],
      code: [...code],
      startedAt: now,
      deadline: roundDeadlineAt,
      leaked: [],
      lockouts: noLockouts(participants),
      tries: Object.fromEntries(participants.map((id) => [id, 0])),
      phase: 'OPEN',
      openedBy: null,
      points: {},
    };
    const firstLeakAt = this.findNextLeakAt(state);
    return {
      state,
      effects: [
        {
          type: 'EMIT',
          event: { type: 'ROUND_STARTED', roundNo, digits: code.length, roundDeadlineAt, firstLeakAt },
        },
        { type: 'SCHEDULE', timer: ROUND_TIMER, at: this.after(roundDeadlineAt, this.config.latencyGraceMs) },
        ...(firstLeakAt ? [{ type: 'SCHEDULE', timer: LEAK_TIMER, at: firstLeakAt } as const] : []),
      ],
    };
  }

  handleCommand(state: VaultRoundState, from: ParticipantId, command: VaultCommand, now: Date): Step | Rejection {
    if (state.phase === 'CLOSED') return reject('ROUND_CLOSED');
    if (!state.participants.includes(from)) return reject('PARTICIPANT_FORFEITED');
    if (now.getTime() > state.deadline.getTime() + this.config.latencyGraceMs) return reject('ROUND_CLOSED');
    if (!this.isWellFormedCode(state, command.code)) return reject('INVALID_CODE');
    if (findLockedUntil(state.lockouts, from, now)) return reject('LOCKED_OUT');
    const opened = command.code === state.code.join('');
    const tries = (state.tries[from] ?? 0) + 1;
    const tried: VaultRoundState = { ...state, tries: { ...state.tries, [from]: tries } };
    const record: Effect<VaultEvent> = {
      type: 'RECORD_ACTION',
      action: {
        participantId: from,
        kind: 'VAULT_TRY',
        answer: { entityId: null, text: command.code },
        isCorrect: opened,
        points: opened ? this.config.points.vaultOpened : 0,
        at: now,
      },
    };
    if (opened) {
      const closed = this.closeRound(tried, from);
      return { state: closed.state, effects: [record, ...closed.effects] };
    }
    return {
      state: { ...tried, lockouts: lockOutAfterWrongTry(state.lockouts, from, now, this.config.lockoutMs) },
      effects: [record, { type: 'EMIT', event: { type: 'TRIED', roundNo: state.roundNo, participantId: from, tries } }],
    };
  }

  handleTimer(state: VaultRoundState, timer: string, random: RandomSource): Step {
    if (state.phase === 'CLOSED') return { state, effects: [] };
    if (timer === ROUND_TIMER) return this.closeRound(state, null);
    if (timer !== LEAK_TIMER || state.leaked.length >= this.leaksAllowed(state)) return { state, effects: [] };
    const hidden = state.code.map((_, position) => position).filter((position) => !state.leaked.includes(position));
    const position = hidden[Math.floor(random.next() * hidden.length)];
    if (position === undefined) return { state, effects: [] };
    const leaked: VaultRoundState = { ...state, leaked: [...state.leaked, position] };
    const nextLeakAt = this.findNextLeakAt(leaked);
    return {
      state: leaked,
      effects: [
        {
          type: 'EMIT',
          event: { type: 'LEAKED', roundNo: state.roundNo, position, digit: state.code[position] ?? 0, nextLeakAt },
        },
        ...(nextLeakAt ? [{ type: 'SCHEDULE', timer: LEAK_TIMER, at: nextLeakAt } as const] : []),
      ],
    };
  }

  /** The other participant gets the round without points; the battle then ends on the forfeit. */
  participantLeft(state: VaultRoundState, who: ParticipantId): Step {
    if (state.phase === 'CLOSED' || !state.participants.includes(who)) return { state, effects: [] };
    const winner = state.participants.find((id) => id !== who) ?? null;
    return this.closeRound(state, winner, 'FORFEIT');
  }

  /** When this player may try again, or null; for the ack and the snapshot. */
  lockedUntilOf(state: VaultRoundState, who: ParticipantId, now: Date): Date | null {
    return findLockedUntil(state.lockouts, who, now);
  }

  private closeRound(
    state: VaultRoundState,
    winner: ParticipantId | null,
    endReason: RoundResult['endReason'] = winner ? 'OPENED' : 'NO_WINNER',
  ): Step {
    const points =
      winner && endReason === 'OPENED'
        ? { ...state.points, [winner]: (state.points[winner] ?? 0) + this.config.points.vaultOpened }
        : state.points;
    return {
      state: { ...state, phase: 'CLOSED', openedBy: endReason === 'OPENED' ? winner : null, points },
      effects: [
        { type: 'CANCEL', timer: ROUND_TIMER },
        { type: 'CANCEL', timer: LEAK_TIMER },
        {
          type: 'END_ROUND',
          result: { winnerParticipantId: winner, endReason, points, stepsRevealed: state.leaked.length },
        },
      ],
    };
  }

  /** The next leak, or null when every leak allowed is out or it would come after the round ends. */
  findNextLeakAt(state: VaultRoundState): Date | null {
    const at = findNextHintAt(
      state.startedAt,
      { ...this.config.leaks, max: this.leaksAllowed(state) },
      state.leaked.length,
    );
    return at && at.getTime() < state.deadline.getTime() ? at : null;
  }

  private leaksAllowed(state: VaultRoundState): number {
    return Math.min(this.config.leaks.max, state.code.length);
  }

  private isWellFormedCode(state: VaultRoundState, code: unknown): code is string {
    return typeof code === 'string' && code.length === state.code.length && /^[0-9]+$/.test(code);
  }

  private after(now: Date, ms: number): Date {
    return new Date(now.getTime() + ms);
  }
}
