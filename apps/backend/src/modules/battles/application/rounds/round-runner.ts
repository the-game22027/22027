import type { AnswerCatalogQuery, AnswerChecker, TypedAnswerRules } from '@modules/question-bank';
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
  | { type: 'GRID_SKIP' };

export type ViewerData = (viewer: LiveParticipant) => Record<string, unknown>;

/** What a round runner may ask of its battle (08 §2.4). Timer keys are scoped to the round by the battle. */
export interface RoundHost {
  readonly gameType: string;
  /** Who moves first in this round (08 §9.1); null when the game type has no first mover. */
  readonly firstMoverId: ParticipantId | null;
  readonly random: RandomSource;
  readonly checker: AnswerChecker;
  readonly catalog: AnswerCatalogQuery;
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
  /** null when accepted, otherwise the ack's error code. */
  handleCommand(from: ParticipantId, command: PlayerCommand): Promise<string | null>;
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
