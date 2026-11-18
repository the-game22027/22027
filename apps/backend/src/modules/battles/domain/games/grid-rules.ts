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

/** Grid values of the battle config (08 §6). Every number is configuration (DEC-54, DEC-61, DEC-33). */
export interface GridConfig {
  turnMs: number;
  attemptsPerTurn: number;
  /** null = unlimited. */
  skipsPerRound: number | null;
  maxTurns: number;
  latencyGraceMs: number;
  showWrongAnswers: boolean;
  points: { roundWin: number; roundDraw: number; perCell: number };
}

export const GRID_CELLS = 9;

/** The 8 lines of a 3×3 board: rows, columns, diagonals (cells are row * 3 + col). */
export const GRID_LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export interface GridRoundState {
  roundNo: number;
  participants: ParticipantId[];
  /** Owner of each cell, or null while free. */
  board: (ParticipantId | null)[];
  /** Players already used on this board, by entity id. */
  usedPlayers: string[];
  phase: 'TURN' | 'CLOSED';
  turnOf: ParticipantId;
  turnNo: number;
  attemptsLeft: number;
  turnDeadlineAt: Date;
  skipsUsed: Record<ParticipantId, number>;
  points: Record<ParticipantId, number>;
  /** The winning line once the round closed on one. */
  line: number[] | null;
}

export type GridEvent =
  | { type: 'ROUND_STARTED'; roundNo: number; firstTurn: ParticipantId }
  | { type: 'TURN'; roundNo: number; participantId: ParticipantId; turnDeadlineAt: Date; attemptsLeft: number }
  | { type: 'CLAIMED'; roundNo: number; cell: number; participantId: ParticipantId; entityId: string }
  | {
      type: 'MISSED';
      roundNo: number;
      cell: number | null;
      participantId: ParticipantId;
      entityId: string | null;
      timedOut: boolean;
      skipped: boolean;
    };

/** A claim's answer names a player, or nobody when the text matched none (08 §5.3). */
export type GridClaimAnswer = Exclude<JudgedAnswer, { number: number }>;

export type GridCommand =
  { type: 'GRID_CLAIM'; cell: number; answer: GridClaimAnswer; verdict: 'CORRECT' | 'WRONG' } | { type: 'GRID_SKIP' };

export const TURN_TIMER = 'turn';

type Step = RulesStep<GridRoundState, GridEvent>;

/** Football tic-tac-toe for exactly two participants (08 §3.2). Pure: no I/O, time passed in. */
export class GridRules {
  constructor(private readonly config: GridConfig) {}

  startRound(roundNo: number, participants: ParticipantId[], firstTurn: ParticipantId, now: Date): Step {
    const state: GridRoundState = {
      roundNo,
      participants: [...participants],
      board: Array.from({ length: GRID_CELLS }, () => null),
      usedPlayers: [],
      phase: 'TURN',
      turnOf: firstTurn,
      turnNo: 0,
      attemptsLeft: 0,
      turnDeadlineAt: now,
      skipsUsed: Object.fromEntries(participants.map((id) => [id, 0])),
      points: {},
      line: null,
    };
    const started: Effect<GridEvent> = { type: 'EMIT', event: { type: 'ROUND_STARTED', roundNo, firstTurn } };
    const turn = this.beginTurn(state, firstTurn, now);
    return { state: turn.state, effects: [started, ...turn.effects] };
  }

  /**
   * Checks a claim without changing anything. The engine calls it with no player before judging the text, and the
   * rules call it again with the judged player, who must not be on the board yet.
   */
  findClaimRejection(
    state: GridRoundState,
    from: ParticipantId,
    cell: number,
    entityId: string | null,
    receivedAt: Date,
  ): Rejection | null {
    const turnProblem = this.findTurnRejection(state, from, receivedAt);
    if (turnProblem) return turnProblem;
    if (!Number.isInteger(cell) || cell < 0 || cell >= GRID_CELLS) return reject('INVALID_PAYLOAD');
    if (state.board[cell] !== null) return reject('CELL_TAKEN');
    if (entityId !== null && state.usedPlayers.includes(entityId)) return reject('PLAYER_ALREADY_USED');
    return null;
  }

  handleCommand(state: GridRoundState, from: ParticipantId, command: GridCommand, now: Date): Step | Rejection {
    if (command.type === 'GRID_SKIP') return this.findTurnRejection(state, from, now) ?? this.skip(state, from, now);
    const { cell, answer } = command;
    const rejection = this.findClaimRejection(state, from, cell, answer.entityId, now);
    if (rejection) return rejection;
    return command.verdict === 'CORRECT' && answer.entityId !== null
      ? this.claim(state, from, cell, { ...answer, entityId: answer.entityId }, now)
      : this.miss(state, from, cell, answer, now);
  }

  handleTimer(state: GridRoundState, timer: string, now: Date): Step {
    if (timer !== TURN_TIMER || state.phase !== 'TURN') return { state, effects: [] };
    const holder = state.turnOf;
    const effects: Effect<GridEvent>[] = [
      { type: 'RECORD_ACTION', action: { participantId: holder, kind: 'TURN_TIMEOUT', points: 0, at: now } },
      this.missedEvent(state, holder, null, null, { timedOut: true, skipped: false }),
    ];
    const next = this.passTurn(state, now);
    return { state: next.state, effects: [...effects, ...next.effects] };
  }

  /** The other participant gets the round (08 §3.2 step 6); the battle then ends on the forfeit. */
  participantLeft(state: GridRoundState, who: ParticipantId): Step {
    if (state.phase === 'CLOSED' || !state.participants.includes(who)) return { state, effects: [] };
    const other = state.participants.find((id) => id !== who) ?? null;
    return this.closeRound(state, other, 'FORFEIT', state.points);
  }

  private findTurnRejection(state: GridRoundState, from: ParticipantId, receivedAt: Date): Rejection | null {
    if (state.phase === 'CLOSED') return reject('ROUND_CLOSED');
    if (!state.participants.includes(from)) return reject('PARTICIPANT_FORFEITED');
    if (state.turnOf !== from) return reject('NOT_YOUR_TURN');
    if (receivedAt.getTime() > state.turnDeadlineAt.getTime() + this.config.latencyGraceMs)
      return reject('TURN_CLOSED');
    return null;
  }

  private claim(
    state: GridRoundState,
    from: ParticipantId,
    cell: number,
    answer: GridClaimAnswer & { entityId: string },
    now: Date,
  ): Step {
    const { entityId } = answer;
    const board = [...state.board];
    board[cell] = from;
    const points = addPoints(state.points, from, this.config.points.perCell);
    const claimed: GridRoundState = { ...state, board, usedPlayers: [...state.usedPlayers, entityId], points };
    const action: RoundAction = {
      participantId: from,
      kind: 'GRID_CLAIM',
      answer,
      cell,
      isCorrect: true,
      points: this.config.points.perCell,
      at: now,
    };
    const effects: Effect<GridEvent>[] = [
      { type: 'CANCEL', timer: TURN_TIMER },
      { type: 'RECORD_ACTION', action },
      { type: 'EMIT', event: { type: 'CLAIMED', roundNo: state.roundNo, cell, participantId: from, entityId } },
    ];
    const line = GRID_LINES.find((candidate) => candidate.every((index) => board[index] === from));
    if (line) {
      const closed = this.closeRound(
        { ...claimed, line: [...line] },
        from,
        'GRID_LINE',
        addPoints(points, from, this.config.points.roundWin),
      );
      return { state: closed.state, effects: [...effects, ...closed.effects] };
    }
    if (board.every((owner) => owner !== null)) {
      const closed = this.closeRound(claimed, null, 'GRID_FULL', this.drawPoints(claimed));
      return { state: closed.state, effects: [...effects, ...closed.effects] };
    }
    const next = this.passTurn(claimed, now);
    return { state: next.state, effects: [...effects, ...next.effects] };
  }

  private miss(state: GridRoundState, from: ParticipantId, cell: number, answer: GridClaimAnswer, now: Date): Step {
    const action: RoundAction = {
      participantId: from,
      kind: 'GRID_CLAIM',
      answer,
      cell,
      isCorrect: false,
      points: 0,
      at: now,
    };
    const effects: Effect<GridEvent>[] = [
      { type: 'RECORD_ACTION', action },
      this.missedEvent(state, from, cell, answer.entityId, { timedOut: false, skipped: false }),
    ];
    const attemptsLeft = state.attemptsLeft - 1;
    if (attemptsLeft > 0) {
      // Same turn, same deadline: another try.
      return {
        state: { ...state, attemptsLeft },
        effects: [
          ...effects,
          {
            type: 'EMIT',
            event: {
              type: 'TURN',
              roundNo: state.roundNo,
              participantId: from,
              turnDeadlineAt: state.turnDeadlineAt,
              attemptsLeft,
            },
          },
        ],
      };
    }
    const next = this.passTurn(state, now);
    return { state: next.state, effects: [{ type: 'CANCEL', timer: TURN_TIMER }, ...effects, ...next.effects] };
  }

  private skip(state: GridRoundState, from: ParticipantId, now: Date): Step {
    const skipsUsed = { ...state.skipsUsed, [from]: (state.skipsUsed[from] ?? 0) + 1 };
    const effects: Effect<GridEvent>[] = [
      { type: 'CANCEL', timer: TURN_TIMER },
      { type: 'RECORD_ACTION', action: { participantId: from, kind: 'GRID_SKIP', points: 0, at: now } },
      this.missedEvent(state, from, null, null, { timedOut: false, skipped: true }),
    ];
    const limit = this.config.skipsPerRound;
    if (limit !== null && skipsUsed[from] > limit) {
      const other = state.participants.find((id) => id !== from) ?? null;
      const points = other ? addPoints(state.points, other, this.config.points.roundWin) : state.points;
      const closed = this.closeRound({ ...state, skipsUsed }, other, 'SKIP_LIMIT', points);
      return { state: closed.state, effects: [...effects, ...closed.effects] };
    }
    const next = this.passTurn({ ...state, skipsUsed }, now);
    return { state: next.state, effects: [...effects, ...next.effects] };
  }

  private passTurn(state: GridRoundState, now: Date): Step {
    const other = state.participants.find((id) => id !== state.turnOf) ?? state.turnOf;
    return this.beginTurn(state, other, now);
  }

  private beginTurn(state: GridRoundState, participant: ParticipantId, now: Date): Step {
    const turnNo = state.turnNo + 1;
    if (turnNo > this.config.maxTurns) return this.closeRound(state, null, 'MAX_TURNS', this.drawPoints(state));
    const turnDeadlineAt = new Date(now.getTime() + this.config.turnMs);
    return {
      state: { ...state, turnOf: participant, turnNo, attemptsLeft: this.config.attemptsPerTurn, turnDeadlineAt },
      effects: [
        {
          type: 'EMIT',
          event: {
            type: 'TURN',
            roundNo: state.roundNo,
            participantId: participant,
            turnDeadlineAt,
            attemptsLeft: this.config.attemptsPerTurn,
          },
        },
        { type: 'SCHEDULE', timer: TURN_TIMER, at: new Date(turnDeadlineAt.getTime() + this.config.latencyGraceMs) },
      ],
    };
  }

  private missedEvent(
    state: GridRoundState,
    participantId: ParticipantId,
    cell: number | null,
    entityId: string | null,
    { timedOut, skipped }: { timedOut: boolean; skipped: boolean },
  ): Effect<GridEvent> {
    return {
      type: 'EMIT',
      event: {
        type: 'MISSED',
        roundNo: state.roundNo,
        cell,
        participantId,
        entityId: this.config.showWrongAnswers ? entityId : null,
        timedOut,
        skipped,
      },
    };
  }

  private drawPoints(state: GridRoundState): Record<ParticipantId, number> {
    return state.participants.reduce((points, id) => addPoints(points, id, this.config.points.roundDraw), state.points);
  }

  private closeRound(
    state: GridRoundState,
    winner: ParticipantId | null,
    endReason: RoundResult['endReason'],
    points: Record<ParticipantId, number>,
  ): Step {
    return {
      state: { ...state, phase: 'CLOSED', points },
      effects: [
        { type: 'CANCEL', timer: TURN_TIMER },
        {
          type: 'END_ROUND',
          result: {
            winnerParticipantId: winner,
            endReason,
            points,
            stepsRevealed: state.board.filter((owner) => owner !== null).length,
          },
        },
      ],
    };
  }
}

function addPoints(
  points: Record<ParticipantId, number>,
  participant: ParticipantId,
  add: number,
): Record<ParticipantId, number> {
  if (add === 0) return points;
  return { ...points, [participant]: (points[participant] ?? 0) + add };
}
