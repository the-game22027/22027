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

/**
 * Who gets the squares a wrong line closes (DEC-85): the opponent (the owner's choice in the demo), or nobody.
 * TODO(DEC-85): the third option, "no line and the turn is lost", is not built.
 */
export type BridgeWrongLine = 'GREY_GIVES_SQUARES' | 'GREY_GIVES_NOTHING';

/** `BRIDGE` values of the battle config (08 §16.6). Every number is configuration (DEC-85). */
export interface BridgeConfig {
  pickMs: number;
  answerMs: number;
  wrongLine: BridgeWrongLine;
  latencyGraceMs: number;
  showWrongAnswers: boolean;
  points: { square: number };
}

export type BridgePhase = 'PICKING' | 'ANSWERING' | 'CLOSED';
export type BridgeAnswerResult = 'RIGHT' | 'WRONG' | 'USED';
export type BridgeEndReason = 'BOARD_COMPLETE' | 'FORFEIT';

/** The two board cells a line joins. */
export interface BridgeLine {
  from: number;
  to: number;
}

/** A drawn line: right lines carry their scorer; a grey line belongs to nobody but remembers who drew it. */
export interface BridgeDrawnLine {
  drawnBy: ParticipantId;
  right: boolean;
  scorerEntityId: string | null;
}

export interface BridgeRoundState {
  roundNo: number;
  participants: ParticipantId[];
  size: number;
  /** Club entity ids, row by row. */
  clubs: string[];
  lines: BridgeLine[];
  drawn: (BridgeDrawnLine | null)[];
  /** Square owners, row by row over (size − 1)²; null while open or when a grey line closed it for nobody. */
  squares: (ParticipantId | null)[];
  turn: ParticipantId;
  phase: BridgePhase;
  /** The line being answered, while `ANSWERING`. */
  line: number | null;
  deadline: Date;
  /** Scorers named right on this board: each one counts once (DEC-85). */
  used: UsedAnswers;
  endReason: BridgeEndReason | null;
  /** Squares won so far, times `points.square`. */
  points: Record<ParticipantId, number>;
}

export type BridgeEvent =
  | { type: 'TURN'; roundNo: number; participantId: ParticipantId; pickDeadlineAt: Date }
  | {
      type: 'QUESTION';
      roundNo: number;
      line: number;
      clubs: [string, string];
      auto: boolean;
      answerDeadlineAt: Date;
    }
  | {
      type: 'DRAWN';
      roundNo: number;
      line: number;
      participantId: ParticipantId;
      result: BridgeAnswerResult | 'TIME_UP';
      /** The scorer of a right line. */
      scorerEntityId: string | null;
      /** What a wrong or used text matched; hidden for a wrong answer unless `showWrongAnswers`. */
      entityId: string | null;
      closed: { square: number; ownerId: ParticipantId | null }[];
      points: Record<ParticipantId, number>;
    };

export type BridgeTextAnswer = Exclude<JudgedAnswer, { number: number }>;

/** `scoredAgainstBoth` is the server's verdict: the named player scored against both clubs of the line. */
export type BridgeCommand =
  | { type: 'BRIDGE_PICK'; line: number }
  | { type: 'BRIDGE_ANSWER'; answer: BridgeTextAnswer; scoredAgainstBoth: boolean };

type Step = RulesStep<BridgeRoundState, BridgeEvent>;

export const PHASE_TIMER = 'phase';

/** The lines of a board, numbered as in 08 §16.1: horizontal lines row by row, then vertical lines row by row. */
export function listBoardLines(size: number): BridgeLine[] {
  const lines: BridgeLine[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size - 1; col++) lines.push({ from: row * size + col, to: row * size + col + 1 });
  }
  for (let row = 0; row < size - 1; row++) {
    for (let col = 0; col < size; col++) lines.push({ from: row * size + col, to: (row + 1) * size + col });
  }
  return lines;
}

/** The four lines around each square (top, bottom, left, right), squares row by row. */
export function listSquareSides(size: number): number[][] {
  const horizontal = size * (size - 1);
  const sides: number[][] = [];
  for (let row = 0; row < size - 1; row++) {
    for (let col = 0; col < size - 1; col++) {
      sides.push([
        row * (size - 1) + col,
        (row + 1) * (size - 1) + col,
        horizontal + row * size + col,
        horizontal + row * size + col + 1,
      ]);
    }
  }
  return sides;
}

/** الكوبري for exactly two participants (08 §16). Pure: no I/O; time, randomness and the verdict are passed in. */
export class BridgeRules {
  constructor(private readonly config: BridgeConfig) {}

  startRound(
    roundNo: number,
    participants: ParticipantId[],
    size: number,
    clubs: string[],
    firstPicker: ParticipantId,
    now: Date,
  ): Step {
    const lines = listBoardLines(size);
    const state: BridgeRoundState = {
      roundNo,
      participants: [...participants],
      size,
      clubs: [...clubs],
      lines,
      drawn: lines.map(() => null),
      squares: listSquareSides(size).map(() => null),
      turn: firstPicker,
      phase: 'PICKING',
      line: null,
      deadline: now,
      used: [],
      endReason: null,
      points: {},
    };
    return this.startTurn(state, firstPicker, now);
  }

  /** Checks an answer before its text is judged: right phase, right player, in time. */
  findAnswerRejection(state: BridgeRoundState, from: ParticipantId, receivedAt: Date): Rejection | null {
    if (state.phase === 'CLOSED') return reject('ROUND_CLOSED');
    if (!state.participants.includes(from)) return reject('PARTICIPANT_FORFEITED');
    if (state.phase !== 'ANSWERING' || from !== state.turn) return reject('NOT_YOUR_TURN');
    if (this.isLate(state, receivedAt)) return reject('ANSWER_WINDOW_CLOSED');
    return null;
  }

  /** Checks a pick: right phase, right player, an open line of this board, in time. */
  findPickRejection(state: BridgeRoundState, from: ParticipantId, line: number, receivedAt: Date): Rejection | null {
    if (state.phase === 'CLOSED') return reject('ROUND_CLOSED');
    if (!state.participants.includes(from)) return reject('PARTICIPANT_FORFEITED');
    if (state.phase !== 'PICKING' || from !== state.turn) return reject('NOT_YOUR_TURN');
    if (!Number.isInteger(line) || line < 0 || line >= state.lines.length) return reject('INVALID_LINE');
    if (state.drawn[line] !== null) return reject('LINE_TAKEN');
    if (this.isLate(state, receivedAt)) return reject('PICK_WINDOW_CLOSED');
    return null;
  }

  handleCommand(state: BridgeRoundState, from: ParticipantId, command: BridgeCommand, now: Date): Step | Rejection {
    switch (command.type) {
      case 'BRIDGE_PICK':
        return this.findPickRejection(state, from, command.line, now) ?? this.pick(state, command.line, false, now);
      case 'BRIDGE_ANSWER':
        return this.findAnswerRejection(state, from, now) ?? this.answer(state, from, command, now);
    }
  }

  handleTimer(state: BridgeRoundState, timer: string, now: Date, random: RandomSource): Step {
    if (timer !== PHASE_TIMER) return { state, effects: [] };
    if (state.phase === 'PICKING') {
      const open = listOpenLines(state);
      const line = open[Math.floor(random.next() * open.length)];
      return line === undefined ? { state, effects: [] } : this.pick(state, line, true, now);
    }
    if (state.phase === 'ANSWERING') {
      const timedOut: RoundAction = {
        participantId: state.turn,
        kind: 'BRIDGE_ANSWER',
        isCorrect: false,
        points: 0,
        at: now,
      };
      const drawn = this.drawLine(state, 'TIME_UP', null, null, now);
      return { state: drawn.state, effects: [{ type: 'RECORD_ACTION', action: timedOut }, ...drawn.effects] };
    }
    return { state, effects: [] };
  }

  /** The other participant wins the board; the battle then ends on the forfeit. */
  participantLeft(state: BridgeRoundState, who: ParticipantId): Step {
    if (state.phase === 'CLOSED' || !state.participants.includes(who)) return { state, effects: [] };
    return this.closeRound(state, state.participants.find((id) => id !== who) ?? null, 'FORFEIT');
  }

  private pick(state: BridgeRoundState, line: number, auto: boolean, now: Date): Step {
    const answerDeadlineAt = this.after(now, this.config.answerMs);
    const { from, to } = state.lines[line];
    return {
      state: { ...state, phase: 'ANSWERING', line, deadline: answerDeadlineAt },
      effects: [
        { type: 'CANCEL', timer: PHASE_TIMER },
        {
          type: 'RECORD_ACTION',
          action: { participantId: state.turn, kind: 'BRIDGE_PICK', cell: line, isCorrect: !auto, points: 0, at: now },
        },
        {
          type: 'EMIT',
          event: {
            type: 'QUESTION',
            roundNo: state.roundNo,
            line,
            clubs: [state.clubs[from], state.clubs[to]],
            auto,
            answerDeadlineAt,
          },
        },
        this.scheduleDeadline(answerDeadlineAt),
      ],
    };
  }

  private answer(
    state: BridgeRoundState,
    from: ParticipantId,
    command: Extract<BridgeCommand, { type: 'BRIDGE_ANSWER' }>,
    now: Date,
  ): Step {
    const entityId = command.answer.entityId;
    const result: BridgeAnswerResult =
      entityId === null || !command.scoredAgainstBoth
        ? 'WRONG'
        : hasAnswerBeenUsed(state.used, entityId)
          ? 'USED'
          : 'RIGHT';
    const recorded: Effect<BridgeEvent> = {
      type: 'RECORD_ACTION',
      action: {
        participantId: from,
        kind: 'BRIDGE_ANSWER',
        answer: command.answer,
        cell: state.line ?? undefined,
        isCorrect: result === 'RIGHT',
        points: 0,
        at: now,
      },
    };
    const drawn = this.drawLine(state, result, entityId, result === 'RIGHT' ? entityId : null, now);
    return { state: drawn.state, effects: [recorded, ...drawn.effects] };
  }

  /**
   * Draws the picked line: in the player's name when right, grey otherwise. Squares it closes go to the player
   * when right, and by `wrongLine` otherwise. A right line that closed a square keeps the turn (08 §16.1 step 4).
   */
  private drawLine(
    state: BridgeRoundState,
    result: BridgeAnswerResult | 'TIME_UP',
    matchedEntityId: string | null,
    scorerEntityId: string | null,
    now: Date,
  ): Step {
    const line = state.line;
    if (line === null) return { state, effects: [] };
    const right = result === 'RIGHT';
    const player = state.turn;
    const opponent = this.opponentOf(state, player);
    const drawn = state.drawn.map((current, index) =>
      index === line ? { drawnBy: player, right, scorerEntityId } : current,
    );
    const owner = right ? player : this.config.wrongLine === 'GREY_GIVES_SQUARES' ? opponent : null;
    const squares = [...state.squares];
    const closed: { square: number; ownerId: ParticipantId | null }[] = [];
    listSquareSides(state.size).forEach((sides, square) => {
      if (sides.includes(line) && sides.every((side) => drawn[side] !== null)) {
        squares[square] = owner;
        closed.push({ square, ownerId: owner });
      }
    });
    const points = { ...state.points };
    if (owner !== null && closed.length > 0) {
      points[owner] = (points[owner] ?? 0) + closed.length * this.config.points.square;
    }
    const shown = result === 'WRONG' && !this.config.showWrongAnswers ? null : right ? null : matchedEntityId;
    const next: BridgeRoundState = {
      ...state,
      drawn,
      squares,
      points,
      line: null,
      used: scorerEntityId === null ? state.used : addUsedAnswer(state.used, scorerEntityId),
    };
    const effects: Effect<BridgeEvent>[] = [
      { type: 'CANCEL', timer: PHASE_TIMER },
      {
        type: 'EMIT',
        event: {
          type: 'DRAWN',
          roundNo: state.roundNo,
          line,
          participantId: player,
          result,
          scorerEntityId,
          entityId: shown,
          closed,
          points,
        },
      },
    ];
    const after = drawn.every((current) => current !== null)
      ? this.closeRound(next, this.leaderOf(next), 'BOARD_COMPLETE')
      : this.startTurn(next, right && closed.length > 0 ? player : opponent, now);
    return { state: after.state, effects: [...effects, ...after.effects] };
  }

  private startTurn(state: BridgeRoundState, participantId: ParticipantId, now: Date): Step {
    const pickDeadlineAt = this.after(now, this.config.pickMs);
    return {
      state: { ...state, phase: 'PICKING', turn: participantId, line: null, deadline: pickDeadlineAt },
      effects: [
        { type: 'EMIT', event: { type: 'TURN', roundNo: state.roundNo, participantId, pickDeadlineAt } },
        this.scheduleDeadline(pickDeadlineAt),
      ],
    };
  }

  /** The participant with the most squares, or null when they are level. */
  private leaderOf(state: BridgeRoundState): ParticipantId | null {
    const counts = state.participants.map((id) => state.squares.filter((owner) => owner === id).length);
    const most = Math.max(...counts);
    const leaders = state.participants.filter((_, index) => counts[index] === most);
    return leaders.length === 1 ? leaders[0] : null;
  }

  private closeRound(state: BridgeRoundState, winner: ParticipantId | null, endReason: BridgeEndReason): Step {
    const result: RoundResult = {
      winnerParticipantId: winner,
      endReason,
      points: state.points,
      stepsRevealed: state.drawn.filter((line) => line !== null).length,
    };
    return {
      state: { ...state, phase: 'CLOSED', line: null, endReason },
      effects: [
        { type: 'CANCEL', timer: PHASE_TIMER },
        { type: 'END_ROUND', result },
      ],
    };
  }

  private opponentOf(state: BridgeRoundState, participantId: ParticipantId): ParticipantId {
    return state.participants.find((id) => id !== participantId) ?? participantId;
  }

  private isLate(state: BridgeRoundState, receivedAt: Date): boolean {
    return receivedAt.getTime() > state.deadline.getTime() + this.config.latencyGraceMs;
  }

  private after(now: Date, ms: number): Date {
    return new Date(now.getTime() + ms);
  }

  private scheduleDeadline(deadline: Date): Effect<BridgeEvent> {
    return { type: 'SCHEDULE', timer: PHASE_TIMER, at: this.after(deadline, this.config.latencyGraceMs) };
  }
}

/** Lines nobody has drawn yet, in board order. */
export function listOpenLines(state: BridgeRoundState): number[] {
  return state.drawn.flatMap((line, index) => (line === null ? [index] : []));
}

/**
 * The bot's pick (08 §16.5): a line that closes a square when there is one; otherwise a line that gives the
 * opponent no third side; otherwise the line that leaves the fewest squares one side from closing.
 */
export function pickLineForBot(state: BridgeRoundState, random: RandomSource): number | null {
  const open = listOpenLines(state);
  if (open.length === 0) return null;
  const sides = listSquareSides(state.size);
  const drawnSides = (square: number[]) => square.filter((side) => state.drawn[side] !== null).length;
  // For each open line: squares it would close, and squares it would leave with three sides.
  const effectOf = (line: number) => {
    const touched = sides.filter((square) => square.includes(line));
    return {
      closes: touched.filter((square) => drawnSides(square) === 3).length,
      opens: touched.filter((square) => drawnSides(square) === 2).length,
    };
  };
  const scored = open.map((line) => ({ line, ...effectOf(line) }));
  const closing = scored.filter((entry) => entry.closes > 0);
  const pool =
    closing.length > 0
      ? closing
      : scored.filter((entry) => entry.opens === Math.min(...scored.map((candidate) => candidate.opens)));
  return pool[Math.floor(random.next() * pool.length)].line;
}
