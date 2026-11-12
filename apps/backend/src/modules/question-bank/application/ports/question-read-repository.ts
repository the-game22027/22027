import type { Locale } from '@shared/kernel';
import type { AnswerKind, EntityKind, GameBody, GameType } from '../../domain/question-content';
import type { AnswerCandidate } from '../../domain/typed-text-judgement';

export const QUESTION_READ_REPOSITORY = Symbol('QUESTION_READ_REPOSITORY');

export interface ContentSelectionCriteria {
  gameType: GameType;
  count: number;
  /** The content must be playable in every one of these locales. */
  locales: readonly Locale[];
  excludeContentIds: readonly string[];
  difficulties?: readonly number[];
  /** Grid only: every cell needs at least this many accepted answers (game config `minAnswersPerCell`). */
  minAnswersPerSlot?: number;
}

export interface StoredGameContent {
  id: string;
  gameType: GameType;
  answerKind: AnswerKind;
  difficulty: number;
  body: GameBody;
  answers: { slot: number; entityId: string }[];
}

export interface TypedAnswerLookup {
  roundAnswerKind: AnswerKind;
  /** Null when no entity has the answered id. */
  entityKind: EntityKind | null;
  isAcceptedForSlot: boolean;
}

export interface SlotAnswers {
  roundAnswerKind: AnswerKind;
  candidates: AnswerCandidate[];
}

export interface CatalogEntityView {
  id: string;
  kind: EntityKind;
  names: { en: string; ar: string };
  search: string[];
  popularity: number;
}

export interface CatalogSnapshot {
  version: string;
  entities: CatalogEntityView[];
}

export interface QuestionReadRepository {
  /** Random ids of published, unexpired content matching the criteria; fewer when the bank is short. */
  pickRandomContentIds(criteria: ContentSelectionCriteria): Promise<string[]>;
  findGameContent(contentId: string): Promise<StoredGameContent | null>;
  /** Entity ids by external ref, hidden entities included (old content may still point at them). */
  findEntityIdsByExternalRefs(externalRefs: readonly string[]): Promise<Map<string, string>>;
  /** Null when the content does not exist. */
  lookUpTypedAnswer(contentId: string, slot: number, entityId: string): Promise<TypedAnswerLookup | null>;
  /** The accepted answers of a slot with their forms; null when the content does not exist. */
  findSlotAnswers(contentId: string, slot: number): Promise<SlotAnswers | null>;
  /** An active entity of this kind with exactly this full name or alias form, not one of `excludeIds`. */
  findEntityIdNamedExactly(kind: AnswerKind, form: string, excludeIds: readonly string[]): Promise<string | null>;
  findEntitiesByIds(entityIds: readonly string[]): Promise<CatalogEntityView[]>;
  /** The most popular active entities of a kind, without the given ids: plausible wrong answers for bots. */
  findPopularEntityIdsOfKind(kind: EntityKind, excludeIds: readonly string[], limit: number): Promise<string[]>;
  /** Checksum of the last imported catalog, or null before any catalog import. */
  findCurrentCatalogVersion(): Promise<string | null>;
  /** The version and its active entities, read from one snapshot of the database; null before any catalog import. */
  readCatalogSnapshot(): Promise<CatalogSnapshot | null>;
}
