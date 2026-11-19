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
import { giveEveryoneHearts, type Hearts, hasHeartsLeft, loseHeart } from './shared/hearts';
import {
  addSecretChoice,
  choicesOf,
  fillMissingSecretChoices,
  findSecretChoiceRejection,
  hasEveryoneChosen,
  type SecretChoice,
  type SecretChoices,
  startSecretChoices,
} from './shared/secret-choices';
import { addUsedAnswer, hasAnswerBeenUsed, type UsedAnswers } from './shared/used-answers';

/** `MINES` values of the battle config (08 §10.6). Every number is configuration. */
export interface MinesConfig {
  minesPerPlayer: number;
  buryMs: number;
  maxWrongBuryTries: number;
  turnMs: number;
  maxTurns: number;
  hearts: number;
  /** DEC-72: what naming your own live mine does. */
  ownMine: 'REJECT' | 'COSTS_HEART';
  detectorCostMs: number;
  latencyGraceMs: number;
  showWrongAnswers: boolean;
  points: { roundWin: number; roundDraw: number; perSafeAnswer: number };
}

export type MineAnswerOutcome = 'SAFE' | 'MINE' | 'WRONG' | 'REPEATED' | 'OWN_MINE' | 'TIMEOUT';

export interface SaidAnswer {
  participantId: ParticipantId;
  entityId: string | null;
  outcome: MineAnswerOutcome;
  /** Who buried the mine, for `MINE`. */
  buriedBy: ParticipantId | null;
}

export interface MinesRoundState {
  roundNo: number;
  participants: ParticipantId[];
  /** Every player of the category, most popular first. */
  category: readonly string[];
  phase: 'BURYING' | 'TURNS' | 'CLOSED';
  buryDeadlineAt: Date;
  mines: SecretChoices;
  wrongBuryTries: Record<ParticipantId, number>;
  /** `<buriedBy>:<entityId>` of every mine that went off. */
  exploded: readonly string[];
  said: readonly SaidAnswer[];
  used: UsedAnswers;
  hearts: Hearts;
  safeAnswers: Record<ParticipantId, number>;
  firstTurn: ParticipantId;
  turnOf: ParticipantId;
  turnNo: number;
  turnDeadlineAt: Date;
  /** Carried from round to round (DEC-75: once per battle by default). */
  detectorUsesLeft: Record<ParticipantId, number>;
  points: Record<ParticipantId, number>;
  endReason: RoundResult['endReason'] | null;
}

export type MinesEvent =
  | { type: 'ROUND_STARTED'; roundNo: number; buryDeadlineAt: Date; firstTurn: ParticipantId }
  | { type: 'TURN'; roundNo: number; participantId: ParticipantId; turnNo: number; turnDeadlineAt: Date }
  | {
      type: 'ANSWERED';
      roundNo: number;
      participantId: ParticipantId;
      outcome: MineAnswerOutcome;
      /** Hidden for a wrong answer unless `showWrongAnswers`; never set for `OWN_MINE`. */
      entityId: string | null;
      buriedBy: ParticipantId | null;
    }
  | {
      type: 'SCANNED';
      roundNo: number;
      participantId: ParticipantId;
      turnDeadlineAt: Date;
      /** Only the scanner may see it. */
      result: 'MINE' | 'CLEAR';
    };

export type MineTextAnswer = Exclude<JudgedAnswer, { number: number }>;

/** `inCategory` is the server's verdict on the typed text against the category (08 §5.3). */
export type MinesCommand =
  | { type: 'MINE_BURY'; answer: MineTextAnswer; inCategory: boolean }
  | { type: 'MINE_ANSWER'; answer: MineTextAnswer; inCategory: boolean }
  | { type: 'MINE_SCAN'; entityId: string | null };

/** An accepted step; `refusal` is set when the command changed state but the ack still reports a refusal. */
export interface MinesStep extends RulesStep<MinesRoundState, MinesEvent> {
  refusal?: string;
}

export const BURY_TIMER = 'bury';
export const TURN_TIMER = 'turn';

const mineKey = (buriedBy: ParticipantId, entityId: string) => `${buriedBy}:${entityId}`;

/** لغم for exactly two participants (08 §10). Pure: no I/O; time and randomness are passed in. */
export class MinesRules {
  constructor(private readonly config: MinesConfig) {}

  startRound(
    roundNo: number,
    participants: ParticipantId[],
    category: readonly string[],
    firstTurn: ParticipantId,
    detectorUsesLeft: Record<ParticipantId, number>,
    now: Date,
  ): MinesStep {
    const buryDeadlineAt = new Date(now.getTime() + this.config.buryMs);
    const state: MinesRoundState = {
      roundNo,
      participants: [...participants],
      category,
      phase: 'BURYING',
      buryDeadlineAt,
      mines: startSecretChoices(participants, this.config.minesPerPlayer),
      wrongBuryTries: Object.fromEntries(participants.map((id) => [id, 0])),
      exploded: [],
      said: [],
      used: [],
      hearts: giveEveryoneHearts(participants, this.config.hearts),
      safeAnswers: Object.fromEntries(participants.map((id) => [id, 0])),
      firstTurn,
      turnOf: firstTurn,
      turnNo: 0,
      turnDeadlineAt: buryDeadlineAt,
      detectorUsesLeft: { ...detectorUsesLeft },
      points: {},
      endReason: null,
    };
    return {
      state,
      effects: [
        { type: 'EMIT', event: { type: 'ROUND_STARTED', roundNo, buryDeadlineAt, firstTurn } },
        { type: 'SCHEDULE', timer: BURY_TIMER, at: new Date(buryDeadlineAt.getTime() + this.config.latencyGraceMs) },
      ],
    };
  }

  /** Checks a bury before the text is judged (`entityId` null) and again after. */
  findBuryRejection(
    state: MinesRoundState,
    from: ParticipantId,
    entityId: string | null,
    receivedAt: Date,
  ): Rejection | null {
    if (state.phase === 'CLOSED') return reject('ROUND_CLOSED');
    if (!state.participants.includes(from)) return reject('PARTICIPANT_FORFEITED');
    if (state.phase !== 'BURYING') return reject('BURY_WINDOW_CLOSED');
    if (receivedAt.getTime() > state.buryDeadlineAt.getTime() + this.config.latencyGraceMs)
      return reject('BURY_WINDOW_CLOSED');
    const choiceProblem = findSecretChoiceRejection(state.mines, from, entityId);
    if (choiceProblem === 'ALL_CHOSEN') return reject('ALL_MINES_BURIED');
    if ((state.wrongBuryTries[from] ?? 0) >= this.config.maxWrongBuryTries) return reject('NO_TRIES_LEFT');
    if (choiceProblem === 'ALREADY_CHOSEN') return reject('ALREADY_BURIED');
    return null;
  }

  /** Checks a turn command before the text is judged. */
  findTurnRejection(state: MinesRoundState, from: ParticipantId, receivedAt: Date): Rejection | null {
    if (state.phase === 'CLOSED') return reject('ROUND_CLOSED');
    if (!state.participants.includes(from)) return reject('PARTICIPANT_FORFEITED');
    if (state.phase !== 'TURNS' || state.turnOf !== from) return reject('NOT_YOUR_TURN');
    if (receivedAt.getTime() > state.turnDeadlineAt.getTime() + this.config.latencyGraceMs)
      return reject('TURN_CLOSED');
    return null;
  }

  handleCommand(state: MinesRoundState, from: ParticipantId, command: MinesCommand, now: Date): MinesStep | Rejection {
    switch (command.type) {
      case 'MINE_BURY':
        return this.bury(state, from, command.answer, command.inCategory, now);
      case 'MINE_ANSWER':
        return this.findTurnRejection(state, from, now) ?? this.answer(state, from, command, now);
      case 'MINE_SCAN':
        return this.findTurnRejection(state, from, now) ?? this.scan(state, from, command.entityId, now);
    }
  }

  handleTimer(state: MinesRoundState, timer: string, now: Date, random: RandomSource): MinesStep {
    if (timer === BURY_TIMER && state.phase === 'BURYING') {
      return this.startTurns({ ...state, mines: fillMissingSecretChoices(state.mines, state.category, random) }, now);
    }
    if (timer === TURN_TIMER && state.phase === 'TURNS') {
      const action: RoundAction = { participantId: state.turnOf, kind: 'TURN_TIMEOUT', points: 0, at: now };
      return this.settleTurn(state, state.turnOf, { entityId: null, outcome: 'TIMEOUT', buriedBy: null }, action, now);
    }
    return { state, effects: [] };
  }

  /** The other participant gets the round; the battle then ends on the forfeit. */
  participantLeft(state: MinesRoundState, who: ParticipantId): MinesStep {
    if (state.phase === 'CLOSED' || !state.participants.includes(who)) return { state, effects: [] };
    const other = state.participants.find((id) => id !== who) ?? null;
    return this.closeRound(state, other, 'FORFEIT');
  }

  /** The other players' mines that have not gone off yet. */
  liveMinesAgainst(state: MinesRoundState, speaker: ParticipantId): { buriedBy: ParticipantId; entityId: string }[] {
    return state.participants
      .filter((id) => id !== speaker)
      .flatMap((buriedBy) =>
        choicesOf(state.mines, buriedBy)
          .filter((mine) => !state.exploded.includes(mineKey(buriedBy, mine.entityId)))
          .map((mine) => ({ buriedBy, entityId: mine.entityId })),
      );
  }

  isOwnLiveMine(state: MinesRoundState, speaker: ParticipantId, entityId: string): boolean {
    return (
      choicesOf(state.mines, speaker).some((mine) => mine.entityId === entityId) &&
      !state.exploded.includes(mineKey(speaker, entityId))
    );
  }

  /** Unsaid players of the category that are nobody's live mine (08 §10.1 step 6). */
  countSafeAnswersLeft(state: MinesRoundState): number {
    const live = new Set(
      state.participants.flatMap((who) =>
        choicesOf(state.mines, who)
          .filter((mine) => !state.exploded.includes(mineKey(who, mine.entityId)))
          .map((mine) => mine.entityId),
      ),
    );
    return state.category.filter((id) => !hasAnswerBeenUsed(state.used, id) && !live.has(id)).length;
  }

  private bury(
    state: MinesRoundState,
    from: ParticipantId,
    answer: MineTextAnswer,
    inCategory: boolean,
    now: Date,
  ): MinesStep | Rejection {
    const entityId = inCategory ? answer.entityId : null;
    const rejection = this.findBuryRejection(state, from, entityId, now);
    if (rejection) return rejection;
    const action: RoundAction = {
      participantId: from,
      kind: 'MINE_BURY',
      answer,
      isCorrect: inCategory,
      points: 0,
      at: now,
    };
    if (entityId === null) {
      const wrongBuryTries = { ...state.wrongBuryTries, [from]: (state.wrongBuryTries[from] ?? 0) + 1 };
      return {
        state: { ...state, wrongBuryTries },
        effects: [{ type: 'RECORD_ACTION', action }],
        refusal: 'NOT_IN_CATEGORY',
      };
    }
    const buried = { ...state, mines: addSecretChoice(state.mines, from, entityId) };
    const effects: Effect<MinesEvent>[] = [{ type: 'RECORD_ACTION', action }];
    if (!hasEveryoneChosen(buried.mines)) return { state: buried, effects };
    const turns = this.startTurns(buried, now);
    return { state: turns.state, effects: [...effects, ...turns.effects] };
  }

  private startTurns(state: MinesRoundState, now: Date): MinesStep {
    const effects: Effect<MinesEvent>[] = [{ type: 'CANCEL', timer: BURY_TIMER }];
    for (const who of state.participants) {
      for (const mine of choicesOf(state.mines, who).filter((choice) => choice.auto)) {
        effects.push({
          type: 'RECORD_ACTION',
          action: {
            participantId: who,
            kind: 'MINE_AUTO_BURY',
            answer: { entityId: mine.entityId },
            points: 0,
            at: now,
          },
        });
      }
    }
    const turn = this.beginTurn({ ...state, phase: 'TURNS' }, state.firstTurn, now);
    return { state: turn.state, effects: [...effects, ...turn.effects] };
  }

  private answer(
    state: MinesRoundState,
    from: ParticipantId,
    command: Extract<MinesCommand, { type: 'MINE_ANSWER' }>,
    now: Date,
  ): MinesStep | Rejection {
    const entityId = command.inCategory ? command.answer.entityId : null;
    const action = (kind: RoundAction['kind'], isCorrect: boolean, points = 0): RoundAction => ({
      participantId: from,
      kind,
      answer: command.answer,
      isCorrect,
      points,
      at: now,
    });
    if (entityId === null) {
      return this.settleTurn(
        state,
        from,
        { entityId: command.answer.entityId, outcome: 'WRONG', buriedBy: null },
        action('MINE_ANSWER', false),
        now,
      );
    }
    if (hasAnswerBeenUsed(state.used, entityId)) {
      return this.settleTurn(
        state,
        from,
        { entityId, outcome: 'REPEATED', buriedBy: null },
        action('MINE_ANSWER', false),
        now,
      );
    }
    if (this.isOwnLiveMine(state, from, entityId)) {
      if (this.config.ownMine === 'REJECT') return reject('OWN_MINE');
      return this.settleTurn(
        state,
        from,
        { entityId, outcome: 'OWN_MINE', buriedBy: from },
        action('MINE_ANSWER', false),
        now,
      );
    }
    const mine = this.liveMinesAgainst(state, from).find((candidate) => candidate.entityId === entityId);
    if (mine) {
      const hit = { ...state, exploded: [...state.exploded, mineKey(mine.buriedBy, entityId)] };
      return this.settleTurn(
        hit,
        from,
        { entityId, outcome: 'MINE', buriedBy: mine.buriedBy },
        action('MINE_HIT', true),
        now,
      );
    }
    const perSafe = this.config.points.perSafeAnswer;
    const safe = {
      ...state,
      safeAnswers: { ...state.safeAnswers, [from]: (state.safeAnswers[from] ?? 0) + 1 },
      points: addPoints(state.points, from, perSafe),
    };
    return this.settleTurn(
      safe,
      from,
      { entityId, outcome: 'SAFE', buriedBy: null },
      action('MINE_ANSWER', true, perSafe),
      now,
    );
  }

  private scan(state: MinesRoundState, from: ParticipantId, entityId: string | null, now: Date): MinesStep | Rejection {
    if ((state.detectorUsesLeft[from] ?? 0) <= 0) return reject('NO_DETECTOR_LEFT');
    const isMine = entityId !== null && this.liveMinesAgainst(state, from).some((mine) => mine.entityId === entityId);
    const turnDeadlineAt = new Date(state.turnDeadlineAt.getTime() - this.config.detectorCostMs);
    const scanned: MinesRoundState = {
      ...state,
      turnDeadlineAt,
      detectorUsesLeft: { ...state.detectorUsesLeft, [from]: (state.detectorUsesLeft[from] ?? 0) - 1 },
    };
    const action: RoundAction = {
      participantId: from,
      kind: 'MINE_SCAN',
      answer: { entityId },
      isCorrect: isMine,
      points: 0,
      at: now,
    };
    return {
      state: scanned,
      effects: [
        { type: 'RECORD_ACTION', action },
        {
          type: 'EMIT',
          event: {
            type: 'SCANNED',
            roundNo: state.roundNo,
            participantId: from,
            turnDeadlineAt,
            result: isMine ? 'MINE' : 'CLEAR',
          },
        },
        { type: 'CANCEL', timer: TURN_TIMER },
        { type: 'SCHEDULE', timer: TURN_TIMER, at: new Date(turnDeadlineAt.getTime() + this.config.latencyGraceMs) },
      ],
    };
  }

  /** Records the outcome, takes a heart for a miss, then ends the round or passes the turn. */
  private settleTurn(
    state: MinesRoundState,
    from: ParticipantId,
    said: Omit<SaidAnswer, 'participantId'>,
    action: RoundAction,
    now: Date,
  ): MinesStep {
    const costsHeart = said.outcome !== 'SAFE';
    const countsAsSaid = said.entityId !== null && (said.outcome === 'SAFE' || said.outcome === 'MINE');
    const next: MinesRoundState = {
      ...state,
      said: [...state.said, { participantId: from, ...said }],
      used: countsAsSaid && said.entityId !== null ? addUsedAnswer(state.used, said.entityId) : state.used,
      hearts: costsHeart ? loseHeart(state.hearts, from) : state.hearts,
    };
    const shownEntityId =
      said.outcome === 'OWN_MINE' || (said.outcome === 'WRONG' && !this.config.showWrongAnswers) ? null : said.entityId;
    const effects: Effect<MinesEvent>[] = [
      { type: 'CANCEL', timer: TURN_TIMER },
      { type: 'RECORD_ACTION', action },
      {
        type: 'EMIT',
        event: {
          type: 'ANSWERED',
          roundNo: state.roundNo,
          participantId: from,
          outcome: said.outcome,
          entityId: shownEntityId,
          buriedBy: said.outcome === 'MINE' ? said.buriedBy : null,
        },
      },
    ];
    if (!hasHeartsLeft(next.hearts, from)) {
      const winner = next.participants.find((id) => id !== from) ?? null;
      const closed = this.closeRound(next, winner, 'LAST_HEART');
      return { state: closed.state, effects: [...effects, ...closed.effects] };
    }
    const other = next.participants.find((id) => id !== from) ?? from;
    const turn = this.beginTurn(next, other, now);
    return { state: turn.state, effects: [...effects, ...turn.effects] };
  }

  private beginTurn(state: MinesRoundState, participant: ParticipantId, now: Date): MinesStep {
    const turnNo = state.turnNo + 1;
    if (turnNo > this.config.maxTurns) return this.closeByTieBreak(state, 'MAX_TURNS');
    if (this.countSafeAnswersLeft(state) === 0) return this.closeByTieBreak(state, 'NO_SAFE_ANSWERS');
    const turnDeadlineAt = new Date(now.getTime() + this.config.turnMs);
    return {
      state: { ...state, turnOf: participant, turnNo, turnDeadlineAt },
      effects: [
        {
          type: 'EMIT',
          event: { type: 'TURN', roundNo: state.roundNo, participantId: participant, turnNo, turnDeadlineAt },
        },
        { type: 'SCHEDULE', timer: TURN_TIMER, at: new Date(turnDeadlineAt.getTime() + this.config.latencyGraceMs) },
      ],
    };
  }

  /** DEC-75: more hearts wins, then more safe answers, else a draw. */
  private closeByTieBreak(state: MinesRoundState, endReason: 'MAX_TURNS' | 'NO_SAFE_ANSWERS'): MinesStep {
    const [first, second] = state.participants;
    const compare =
      (state.hearts[first] ?? 0) - (state.hearts[second] ?? 0) ||
      (state.safeAnswers[first] ?? 0) - (state.safeAnswers[second] ?? 0);
    const winner = compare > 0 ? first : compare < 0 ? second : null;
    return this.closeRound(state, winner, endReason);
  }

  private closeRound(
    state: MinesRoundState,
    winner: ParticipantId | null,
    endReason: RoundResult['endReason'],
  ): MinesStep {
    const { roundWin, roundDraw } = this.config.points;
    const points =
      endReason === 'FORFEIT'
        ? state.points
        : winner !== null
          ? addPoints(state.points, winner, roundWin)
          : state.participants.reduce((sum, id) => addPoints(sum, id, roundDraw), state.points);
    return {
      state: { ...state, phase: 'CLOSED', points, endReason },
      effects: [
        { type: 'CANCEL', timer: BURY_TIMER },
        { type: 'CANCEL', timer: TURN_TIMER },
        {
          type: 'END_ROUND',
          result: { winnerParticipantId: winner, endReason, points, stepsRevealed: state.said.length },
        },
      ],
    };
  }
}

export const minesOf = (state: MinesRoundState, who: ParticipantId): readonly SecretChoice[] =>
  choicesOf(state.mines, who);

export const isMineExploded = (state: MinesRoundState, buriedBy: ParticipantId, entityId: string): boolean =>
  state.exploded.includes(mineKey(buriedBy, entityId));

function addPoints(
  points: Record<ParticipantId, number>,
  participant: ParticipantId,
  add: number,
): Record<ParticipantId, number> {
  if (add === 0) return points;
  return { ...points, [participant]: (points[participant] ?? 0) + add };
}
