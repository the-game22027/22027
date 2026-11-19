import type { RandomSource } from '../random-source';
import {
  type Effect,
  type ParticipantId,
  type Rejection,
  reject,
  type RoundAction,
  type RoundResult,
  type RulesStep,
} from './game-rules';
import { findLockedUntil, lockOutAfterWrongTry, type Lockouts, noLockouts } from './shared/lockout-ladder';

/** `HEX` values of the battle config (08 §13.7). Every number is configuration. */
export interface HexConfig {
  pickMs: number;
  answerMs: number;
  lockoutMs: number[];
  /** DEC-79: a board with no connection after this many picks has no winner. */
  maxPicks: number;
  latencyGraceMs: number;
  showWrongAnswers: boolean;
  points: { boardWin: number };
}

export type HexSide = 'WEST_EAST' | 'NORTH_SOUTH';
export type HexPhase = 'PICKING' | 'RACING' | 'CLOSED';
export type HexOutcome = 'CONNECTED' | 'MAX_PICKS' | 'FORFEIT';

export interface HexRoundState {
  roundNo: number;
  participants: ParticipantId[];
  size: number;
  questionsPerCell: number;
  sides: Record<ParticipantId, HexSide>;
  /** Owner of each cell, row by row; null when open. */
  owners: (ParticipantId | null)[];
  /** Which of its questions each cell asks next. */
  questionOf: number[];
  phase: HexPhase;
  /** Whose pick it is, or who picked the cell being raced. */
  turnOf: ParticipantId;
  deadline: Date;
  racingCell: number | null;
  /** Lockouts of the current race only. */
  lockouts: Lockouts;
  picks: number;
  /** "شيلها" uses left, for the whole battle (handed on between boards). */
  clearsLeft: Record<ParticipantId, number>;
  outcome: HexOutcome | null;
  path: number[];
  points: Record<ParticipantId, number>;
}

export type HexEvent =
  | {
      type: 'ROUND_STARTED';
      roundNo: number;
      sides: Record<ParticipantId, HexSide>;
      firstPicker: ParticipantId;
      pickDeadlineAt: Date;
      clearsLeft: Record<ParticipantId, number>;
    }
  | { type: 'TURN'; roundNo: number; participantId: ParticipantId; pickDeadlineAt: Date }
  | {
      type: 'RACE';
      roundNo: number;
      cell: number;
      pickedBy: ParticipantId;
      auto: boolean;
      cleared: boolean;
      questionIndex: number;
      answerDeadlineAt: Date;
    }
  | { type: 'ANSWERED'; roundNo: number; participantId: ParticipantId; entityId: string | null; lockedUntil: Date }
  | { type: 'CLAIMED'; roundNo: number; cell: number; participantId: ParticipantId; entityId: string }
  | { type: 'EXPIRED'; roundNo: number; cell: number };

/** `correct` is the server's verdict on the typed text: a name of the cell's list starting with its letter. */
export type HexCommand =
  | { type: 'HEX_PICK'; cell: number; clear: boolean }
  | { type: 'HEX_ANSWER'; answer: { entityId: string | null; text?: string }; correct: boolean };

type Step = RulesStep<HexRoundState, HexEvent>;

export const PHASE_TIMER = 'phase';

/** الهجمة for exactly two participants (08 §13). Pure: no I/O; time and randomness are passed in. */
export class HexRules {
  constructor(private readonly config: HexConfig) {}

  startRound(input: {
    roundNo: number;
    participants: ParticipantId[];
    size: number;
    questionsPerCell: number;
    firstPicker: ParticipantId;
    clearsLeft: Record<ParticipantId, number>;
    now: Date;
  }): Step {
    const { roundNo, participants, size, firstPicker, now } = input;
    const second = participants.find((id) => id !== firstPicker) ?? firstPicker;
    const sides: Record<ParticipantId, HexSide> = { [firstPicker]: 'WEST_EAST', [second]: 'NORTH_SOUTH' };
    const pickDeadlineAt = this.after(now, this.config.pickMs);
    const state: HexRoundState = {
      roundNo,
      participants: [...participants],
      size,
      questionsPerCell: input.questionsPerCell,
      sides,
      owners: Array.from({ length: size * size }, () => null),
      questionOf: Array.from({ length: size * size }, () => 0),
      phase: 'PICKING',
      turnOf: firstPicker,
      deadline: pickDeadlineAt,
      racingCell: null,
      lockouts: noLockouts(participants),
      picks: 0,
      clearsLeft: { ...input.clearsLeft },
      outcome: null,
      path: [],
      points: {},
    };
    return {
      state,
      effects: [
        {
          type: 'EMIT',
          event: { type: 'ROUND_STARTED', roundNo, sides, firstPicker, pickDeadlineAt, clearsLeft: state.clearsLeft },
        },
        this.scheduleDeadline(pickDeadlineAt),
      ],
    };
  }

  /** Checks an answer before its text is judged: a race is on, the player may answer, in time. */
  findAnswerRejection(state: HexRoundState, from: ParticipantId, now: Date): Rejection | null {
    if (state.phase === 'CLOSED') return reject('ROUND_CLOSED');
    if (!state.participants.includes(from)) return reject('PARTICIPANT_FORFEITED');
    if (state.phase !== 'RACING') return reject('NOT_RACING');
    if (this.isLate(state, now)) return reject('ANSWER_WINDOW_CLOSED');
    if (findLockedUntil(state.lockouts, from, now)) return reject('LOCKED_OUT');
    return null;
  }

  handleCommand(state: HexRoundState, from: ParticipantId, command: HexCommand, now: Date): Step | Rejection {
    if (state.phase === 'CLOSED') return reject('ROUND_CLOSED');
    if (!state.participants.includes(from)) return reject('PARTICIPANT_FORFEITED');
    switch (command.type) {
      case 'HEX_PICK':
        return this.pick(state, from, command.cell, command.clear, now);
      case 'HEX_ANSWER':
        return this.findAnswerRejection(state, from, now) ?? this.answer(state, from, command, now);
    }
  }

  handleTimer(state: HexRoundState, timer: string, now: Date, random: RandomSource): Step {
    if (timer !== PHASE_TIMER) return { state, effects: [] };
    if (state.phase === 'PICKING') {
      const open = this.openCells(state);
      const cell = open[Math.floor(random.next() * open.length)];
      if (cell === undefined) return this.closeRound(state, null, 'MAX_PICKS');
      const timedOut: RoundAction = { participantId: state.turnOf, kind: 'TURN_TIMEOUT', points: 0, at: now };
      const step = this.startRace(state, state.turnOf, cell, { auto: true, cleared: false }, now);
      return { state: step.state, effects: [{ type: 'RECORD_ACTION', action: timedOut }, ...step.effects] };
    }
    if (state.phase === 'RACING' && state.racingCell !== null) {
      const cell = state.racingCell;
      const expired: HexRoundState = { ...state, questionOf: this.advanceQuestion(state, cell), racingCell: null };
      const next = this.nextTurn(expired, now);
      return {
        state: next.state,
        effects: [{ type: 'EMIT', event: { type: 'EXPIRED', roundNo: state.roundNo, cell } }, ...next.effects],
      };
    }
    return { state, effects: [] };
  }

  /** The other participant gets the board without points; the battle then ends on the forfeit. */
  participantLeft(state: HexRoundState, who: ParticipantId): Step {
    if (state.phase === 'CLOSED' || !state.participants.includes(who)) return { state, effects: [] };
    return this.closeRound(state, this.otherThan(state, who), 'FORFEIT');
  }

  lockedUntilOf(state: HexRoundState, who: ParticipantId, now: Date): Date | null {
    return findLockedUntil(state.lockouts, who, now);
  }

  /** Open cells on the shortest way to join this player's sides, counting open cells (for the bot, 08 §13.6). */
  findShortestOpenPath(state: HexRoundState, who: ParticipantId): number[] {
    return findShortestPath(state.size, state.sides[who] ?? 'WEST_EAST', (cell) => {
      const owner = state.owners[cell];
      if (owner === who) return 0;
      return owner === null ? 1 : null;
    }).filter((cell) => state.owners[cell] === null);
  }

  private pick(state: HexRoundState, from: ParticipantId, cell: number, clear: boolean, now: Date): Step | Rejection {
    if (state.phase !== 'PICKING' || state.turnOf !== from) return reject('NOT_YOUR_PICK');
    if (this.isLate(state, now)) return reject('PICK_WINDOW_CLOSED');
    if (!Number.isInteger(cell) || cell < 0 || cell >= state.owners.length) return reject('INVALID_CELL');
    const owner = state.owners[cell];
    if (!clear) {
      if (owner !== null) return reject('CELL_TAKEN');
      return this.startRace(state, from, cell, { auto: false, cleared: false }, now);
    }
    if ((state.clearsLeft[from] ?? 0) <= 0) return reject('NO_CLEARS_LEFT');
    if (owner === null || owner === from) return reject('CELL_NOT_OPPONENTS');
    const cleared: HexRoundState = {
      ...state,
      owners: state.owners.map((current, index) => (index === cell ? null : current)),
      questionOf: this.advanceQuestion(state, cell),
      clearsLeft: { ...state.clearsLeft, [from]: (state.clearsLeft[from] ?? 0) - 1 },
    };
    const race = this.startRace(cleared, from, cell, { auto: false, cleared: true }, now);
    return {
      state: race.state,
      effects: [
        { type: 'RECORD_ACTION', action: { participantId: from, kind: 'HEX_CLEAR', cell, points: 0, at: now } },
        ...race.effects,
      ],
    };
  }

  private startRace(
    state: HexRoundState,
    pickedBy: ParticipantId,
    cell: number,
    how: { auto: boolean; cleared: boolean },
    now: Date,
  ): Step {
    const answerDeadlineAt = this.after(now, this.config.answerMs);
    const racing: HexRoundState = {
      ...state,
      phase: 'RACING',
      turnOf: pickedBy,
      racingCell: cell,
      deadline: answerDeadlineAt,
      lockouts: noLockouts(state.participants),
      picks: state.picks + 1,
    };
    const action: RoundAction = {
      participantId: pickedBy,
      kind: 'HEX_PICK',
      cell,
      isCorrect: !how.auto,
      points: 0,
      at: now,
    };
    return {
      state: racing,
      effects: [
        { type: 'CANCEL', timer: PHASE_TIMER },
        ...(how.cleared ? [] : [{ type: 'RECORD_ACTION', action } as const]),
        {
          type: 'EMIT',
          event: {
            type: 'RACE',
            roundNo: state.roundNo,
            cell,
            pickedBy,
            auto: how.auto,
            cleared: how.cleared,
            questionIndex: state.questionOf[cell] ?? 0,
            answerDeadlineAt,
          },
        },
        this.scheduleDeadline(answerDeadlineAt),
      ],
    };
  }

  private answer(
    state: HexRoundState,
    from: ParticipantId,
    command: Extract<HexCommand, { type: 'HEX_ANSWER' }>,
    now: Date,
  ): Step {
    const cell = state.racingCell ?? 0;
    const entityId = command.answer.entityId;
    const record: Effect<HexEvent> = {
      type: 'RECORD_ACTION',
      action: {
        participantId: from,
        kind: 'HEX_ANSWER',
        answer: command.answer,
        cell,
        isCorrect: command.correct,
        points: 0,
        at: now,
      },
    };
    if (!command.correct || entityId === null) {
      const lockouts = lockOutAfterWrongTry(state.lockouts, from, now, this.config.lockoutMs);
      const lockedUntil = findLockedUntil(lockouts, from, now) ?? now;
      return {
        state: { ...state, lockouts },
        effects: [
          record,
          {
            type: 'EMIT',
            event: {
              type: 'ANSWERED',
              roundNo: state.roundNo,
              participantId: from,
              entityId: this.config.showWrongAnswers ? entityId : null,
              lockedUntil,
            },
          },
        ],
      };
    }
    const claimed: HexRoundState = {
      ...state,
      owners: state.owners.map((owner, index) => (index === cell ? from : owner)),
      questionOf: this.advanceQuestion(state, cell),
      racingCell: null,
    };
    const effects: Effect<HexEvent>[] = [
      record,
      { type: 'EMIT', event: { type: 'CLAIMED', roundNo: state.roundNo, cell, participantId: from, entityId } },
    ];
    const path = this.findConnection(claimed, from);
    const after = path ? this.closeRound({ ...claimed, path }, from, 'CONNECTED') : this.nextTurn(claimed, now);
    return { state: after.state, effects: [...effects, ...after.effects] };
  }

  private nextTurn(state: HexRoundState, now: Date): Step {
    if (state.picks >= this.config.maxPicks || this.openCells(state).length === 0) {
      return this.closeRound(state, null, 'MAX_PICKS');
    }
    const next = this.otherThan(state, state.turnOf) ?? state.turnOf;
    const pickDeadlineAt = this.after(now, this.config.pickMs);
    return {
      state: { ...state, phase: 'PICKING', turnOf: next, deadline: pickDeadlineAt, racingCell: null },
      effects: [
        { type: 'CANCEL', timer: PHASE_TIMER },
        { type: 'EMIT', event: { type: 'TURN', roundNo: state.roundNo, participantId: next, pickDeadlineAt } },
        this.scheduleDeadline(pickDeadlineAt),
      ],
    };
  }

  private closeRound(state: HexRoundState, winner: ParticipantId | null, outcome: HexOutcome): Step {
    const points =
      winner !== null && outcome === 'CONNECTED'
        ? { ...state.points, [winner]: (state.points[winner] ?? 0) + this.config.points.boardWin }
        : state.points;
    const endReason: RoundResult['endReason'] =
      outcome === 'CONNECTED' ? 'CONNECTED' : outcome === 'FORFEIT' ? 'FORFEIT' : 'MAX_TURNS';
    return {
      state: { ...state, phase: 'CLOSED', outcome, points, racingCell: null },
      effects: [
        { type: 'CANCEL', timer: PHASE_TIMER },
        {
          type: 'END_ROUND',
          result: {
            winnerParticipantId: winner,
            endReason,
            points,
            stepsRevealed: state.picks,
            carryOver: { clearsLeft: state.clearsLeft },
          },
        },
      ],
    };
  }

  /** The owner's cells joining their two sides, or null. */
  private findConnection(state: HexRoundState, who: ParticipantId): number[] | null {
    const path = findShortestPath(state.size, state.sides[who] ?? 'WEST_EAST', (cell) =>
      state.owners[cell] === who ? 0 : null,
    );
    return path.length > 0 ? path : null;
  }

  private advanceQuestion(state: HexRoundState, cell: number): number[] {
    return state.questionOf.map((index, current) =>
      current === cell ? (index + 1) % Math.max(1, state.questionsPerCell) : index,
    );
  }

  private openCells(state: HexRoundState): number[] {
    return state.owners.flatMap((owner, cell) => (owner === null ? [cell] : []));
  }

  private otherThan(state: HexRoundState, who: ParticipantId): ParticipantId | null {
    return state.participants.find((id) => id !== who) ?? null;
  }

  private isLate(state: HexRoundState, receivedAt: Date): boolean {
    return receivedAt.getTime() > state.deadline.getTime() + this.config.latencyGraceMs;
  }

  private after(now: Date, ms: number): Date {
    return new Date(now.getTime() + ms);
  }

  private scheduleDeadline(deadline: Date): Effect<HexEvent> {
    return { type: 'SCHEDULE', timer: PHASE_TIMER, at: this.after(deadline, this.config.latencyGraceMs) };
  }
}

/**
 * Cells touching `cell` on a board whose odd rows sit half a cell to the right (08 §13.1): up to 6.
 * Cells are numbered row by row.
 */
export function findNeighbourCells(size: number, cell: number): number[] {
  const row = Math.floor(cell / size);
  const col = cell % size;
  const shift = row % 2 === 0 ? -1 : 0;
  const candidates: [number, number][] = [
    [row, col - 1],
    [row, col + 1],
    [row - 1, col + shift],
    [row - 1, col + shift + 1],
    [row + 1, col + shift],
    [row + 1, col + shift + 1],
  ];
  return candidates.filter(([r, c]) => r >= 0 && r < size && c >= 0 && c < size).map(([r, c]) => r * size + c);
}

/**
 * The cheapest chain of cells joining a side's two edges, where `costOf` gives each cell's cost (0 owned,
 * 1 open) or null when it is blocked; an empty array when there is none. A 0-1 breadth-first search.
 */
export function findShortestPath(size: number, side: HexSide, costOf: (cell: number) => number | null): number[] {
  const isStart = (cell: number) => (side === 'WEST_EAST' ? cell % size === 0 : cell < size);
  const isEnd = (cell: number) => (side === 'WEST_EAST' ? cell % size === size - 1 : cell >= size * (size - 1));
  const distance = new Map<number, number>();
  const previous = new Map<number, number>();
  const queue: number[] = [];
  for (let cell = 0; cell < size * size; cell += 1) {
    const cost = costOf(cell);
    if (!isStart(cell) || cost === null) continue;
    distance.set(cell, cost);
    if (cost === 0) queue.unshift(cell);
    else queue.push(cell);
  }
  while (queue.length > 0) {
    const cell = queue.shift() as number;
    const here = distance.get(cell) ?? 0;
    for (const next of findNeighbourCells(size, cell)) {
      const cost = costOf(next);
      if (cost === null) continue;
      const through = here + cost;
      if (through >= (distance.get(next) ?? Number.POSITIVE_INFINITY)) continue;
      distance.set(next, through);
      previous.set(next, cell);
      if (cost === 0) queue.unshift(next);
      else queue.push(next);
    }
  }
  let best: number | null = null;
  for (const [cell, cost] of distance) {
    if (isEnd(cell) && (best === null || cost < (distance.get(best) ?? 0))) best = cell;
  }
  if (best === null) return [];
  const path = [best];
  while (previous.has(path[0])) path.unshift(previous.get(path[0]) as number);
  return path;
}
