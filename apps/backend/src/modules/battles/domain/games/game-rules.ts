/**
 * The contract between the battle engine and a game's rules (08 §2.2): the rules are pure, they get the
 * round state and an input, and return the new state plus effects that the engine carries out.
 */

export type ParticipantId = string;

/** What a round's rules ask the engine to do. The engine adds `seq` and `serverTime` to emitted events. */
export type Effect<Event> =
  | { type: 'EMIT'; event: Event }
  | { type: 'SCHEDULE'; timer: string; at: Date }
  | { type: 'CANCEL'; timer: string }
  | { type: 'RECORD_ACTION'; action: RoundAction }
  | { type: 'END_ROUND'; result: RoundResult };

export interface RulesStep<State, Event> {
  state: State;
  effects: Effect<Event>[];
}

/** A command the rules refused; `code` becomes the ack's error code (WEBSOCKET.md §3). */
export interface Rejection {
  rejected: true;
  code: string;
}

export const reject = (code: string): Rejection => ({ rejected: true, code });

export const isRejection = (value: unknown): value is Rejection =>
  typeof value === 'object' && value !== null && (value as Rejection).rejected === true;

/** One accepted player action or timeout, persisted to battle_round_actions in this order. */
export interface RoundAction {
  participantId: ParticipantId;
  kind:
    | 'BUZZ'
    | 'ANSWER'
    | 'ANSWER_TIMEOUT'
    | 'GRID_CLAIM'
    | 'GRID_SKIP'
    | 'TURN_TIMEOUT'
    | 'MINE_BURY'
    | 'MINE_AUTO_BURY'
    | 'MINE_ANSWER'
    | 'MINE_HIT'
    | 'MINE_SCAN'
    | 'AUCTION_PICK'
    | 'AUCTION_BID'
    | 'AUCTION_CALL'
    | 'AUCTION_ANSWER'
    | 'AUCTION_STEAL'
    | 'VAULT_TRY'
    | 'HEX_PICK'
    | 'HEX_CLEAR'
    | 'HEX_ANSWER'
    | 'LINEUP_ANSWER'
    | 'LINEUP_ACCUSE'
    | 'ONE_TWO_PASS'
    | 'ONE_TWO_ANSWER';
  answer?: JudgedAnswer;
  /** Grid only: row * 3 + col. */
  cell?: number;
  isCorrect?: boolean;
  points: number;
  at: Date;
}

/** How a typed text matched an answer (08 §5.3); question-bank's `TextMatch`, repeated to keep the domain plain. */
export type TextMatch = 'EXACT' | 'TYPO' | 'OTHER_ENTITY' | 'NONE';

/**
 * An answer after the server judged it. `entityId` is the entity it names, or null when it names nobody. `text`
 * and `match` exist only for a human's typed text, which is recorded but never shown to others (ADR-0021).
 */
export type JudgedAnswer = { entityId: string | null; text?: string; match?: TextMatch } | { number: number };

export interface RoundResult {
  winnerParticipantId: ParticipantId | null;
  endReason:
    | 'CORRECT'
    | 'NO_WINNER'
    | 'ALL_LOCKED_OUT'
    | 'GRID_LINE'
    | 'GRID_FULL'
    | 'MAX_TURNS'
    | 'SKIP_LIMIT'
    | 'LAST_HEART'
    | 'NO_SAFE_ANSWERS'
    | 'PROVED'
    | 'STOLEN'
    | 'BUST'
    | 'OPENED'
    | 'CONNECTED'
    | 'LINEUP_COMPLETE'
    | 'TIME_UP'
    | 'MISSED'
    | 'DEAD_END'
    | 'MAX_PASSES'
    | 'FORFEIT';
  /** Points earned in this round, by participant; missing means 0. */
  points: Record<ParticipantId, number>;
  stepsRevealed: number;
  /** Opaque state handed to the next round's runner (08 §10.7); the engine stores it without reading it. */
  carryOver?: unknown;
}
