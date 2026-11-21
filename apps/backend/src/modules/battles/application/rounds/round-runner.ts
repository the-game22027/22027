import type { AnswerCatalogQuery, AnswerChecker, LinkGraphQuery, TypedAnswerRules } from '@modules/question-bank';
import type { ParticipantId, RoundAction, RoundResult } from '../../domain/games/game-rules';
import type { RandomSource } from '../../domain/random-source';
import type { LiveParticipant } from '../live-participant';

/** An answer as a player sends it (WEBSOCKET.md §2): typed text, or a number. */
export type PlayerAnswer = { text: string } | { number: number };

/** Bots answer with an entity id inside the server and skip text judging (08 §5.3). */
export type BotAnswer = { entityId: string };

/** Every round command a player (or a bot) can send, whatever the game (WEBSOCKET.md §3). */
export type PlayerCommand =
  | { type: 'BUZZ' }
  | { type: 'ANSWER'; answer: PlayerAnswer | BotAnswer }
  | { type: 'GRID_CLAIM'; cell: number; answer: { text: string } | BotAnswer }
  | { type: 'GRID_SKIP' }
  | { type: 'MINE_BURY'; answer: { text: string } | BotAnswer }
  | { type: 'MINE_ANSWER'; answer: { text: string } | BotAnswer }
  | { type: 'MINE_SCAN'; answer: { text: string } }
  | { type: 'AUCTION_PICK'; list: number }
  | { type: 'AUCTION_BID'; amount: number }
  | { type: 'AUCTION_CALL' }
  | { type: 'AUCTION_ANSWER'; answer: { text: string } | BotAnswer }
  | { type: 'VAULT_TRY'; code: string }
  | { type: 'HEX_PICK'; cell: number; clear: boolean }
  | { type: 'HEX_ANSWER'; answer: { text: string } | BotAnswer }
  | { type: 'LINEUP_ANSWER'; answer: { text: string } | BotAnswer }
  | { type: 'ONE_TWO_PASS'; passType: string }
  | { type: 'ONE_TWO_ANSWER'; answer: { text: string } | BotAnswer }
  | { type: 'BRIDGE_PICK'; line: number }
  | { type: 'BRIDGE_ANSWER'; answer: { text: string } | BotAnswer }
  | { type: 'THREAD_ANSWER'; room: number; answer: { text: string } | BotAnswer }
  | { type: 'THREAD_JUMP'; room: number };

/** null when accepted, a string for the ack's error code, or an accepted ack that carries data (08 §10.3). */
export type RoundCommandOutcome = string | null | { accepted: true; data: Record<string, unknown> };

export type ViewerData = (viewer: LiveParticipant) => Record<string, unknown>;

/** What a round runner may ask of its battle (08 §2.4). Timer keys are scoped to the round by the battle. */
export interface RoundHost {
  readonly gameType: string;
  /** Who moves first in this round (08 §9.1); null when the game type has no first mover. */
  readonly firstMoverId: ParticipantId | null;
  /** What the previous round of this battle handed on (`RoundResult.carryOver`); undefined in round 1. */
  readonly carryOver: unknown;
  readonly random: RandomSource;
  readonly checker: AnswerChecker;
  readonly catalog: AnswerCatalogQuery;
  readonly linkGraph: LinkGraphQuery;
  readonly answerRules: TypedAnswerRules;
  now(): Date;
  participants(): LiveParticipant[];
  activeParticipantIds(): ParticipantId[];
  emit(type: string, dataFor: ViewerData): Promise<void>;
  schedule(key: string, at: Date, task: () => Promise<void>): void;
  cancel(key: string): void;
  recordAction(action: RoundAction): Promise<void>;
  /** `revealFor` builds the `reveal` of `round:result` for each viewer. */
  endRound(result: RoundResult, revealFor: ViewerData): Promise<void>;
}

/** One round of one mechanic: its rules, its events, its bot and its snapshot (08 §2.4). */
export interface RoundRunner {
  readonly roundNo: number;
  start(): Promise<void>;
  handleCommand(from: ParticipantId, command: PlayerCommand): Promise<RoundCommandOutcome>;
  participantLeft(who: ParticipantId): Promise<void>;
  snapshotFor(viewer: LiveParticipant): Record<string, unknown>;
}

export type EntityNames = Map<string, { en: string; ar: string }>;

/** Names of catalog entities in one query, for events in each viewer's language. */
export async function loadEntityNames(catalog: AnswerCatalogQuery, ids: readonly string[]): Promise<EntityNames> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  return new Map((await catalog.findEntitiesByIds(unique)).map((entity) => [entity.id, entity.names]));
}

export const entityRef = (names: EntityNames, entityId: string, viewer: LiveParticipant) => ({
  entityId,
  name: names.get(entityId)?.[viewer.locale] ?? '',
});
