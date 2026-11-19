import type { Locale } from '@shared/kernel';
import type { AnswerKind, EntityKind, GameBody, GameType } from '../../domain/question-content';
import type { AnswerCandidate } from '../../domain/typed-text-judgement';

export const QUESTION_READ_REPOSITORY = Symbol('QUESTION_READ_REPOSITORY');

/** What every picked content id must match, whichever way it is picked. */
export interface ContentFilter {
  gameType: GameType;
  count: number;
  /** The content must be playable in every one of these locales. */
  locales: readonly Locale[];
  difficulties?: readonly number[];
  /** Grid only: every cell needs at least this many accepted answers (game config `minAnswersPerCell`). */
  minAnswersPerSlot?: number;
}

export interface ContentSelectionCriteria extends ContentFilter {
  excludeContentIds: readonly string[];
}

export interface StoredGameContent {
  id: string;
  gameType: GameType;
  answerKind: AnswerKind;
  difficulty: number;
  body: GameBody;
  answers: { slot: number; entityId: string }[];
}

export interface SlotAnswers {
  roundAnswerKind: AnswerKind;
  candidates: AnswerCandidate[];
}

export interface CatalogEntityView {
  id: string;
  kind: EntityKind;
  names: { en: string; ar: string };
  popularity: number;
}

export interface QuestionReadRepository {
  /** Random ids of published, unexpired content matching the criteria; fewer when the bank is short. */
  pickRandomContentIds(criteria: ContentSelectionCriteria): Promise<string[]>;
  /** The first `filter.count` candidates, in the given order, that are published, unexpired and match the filter. */
  pickMatchingContentIdsInGivenOrder(filter: ContentFilter, candidateContentIds: readonly string[]): Promise<string[]>;
  findGameContent(contentId: string): Promise<StoredGameContent | null>;
  /** Entity ids by external ref, hidden entities included (old content may still point at them). */
  findEntityIdsByExternalRefs(externalRefs: readonly string[]): Promise<Map<string, string>>;
  /** The accepted answers of a slot with their forms; null when the content does not exist. */
  findSlotAnswers(contentId: string, slot: number): Promise<SlotAnswers | null>;
  /** An active entity of this kind with exactly this full name or alias form, not one of `excludeIds`. */
  findEntityIdNamedExactly(kind: AnswerKind, form: string, excludeIds: readonly string[]): Promise<string | null>;
  findEntitiesByIds(entityIds: readonly string[]): Promise<CatalogEntityView[]>;
  /** The most popular active entities of a kind, without the given ids: plausible wrong answers for bots. */
  findPopularEntityIdsOfKind(kind: EntityKind, excludeIds: readonly string[], limit: number): Promise<string[]>;
}
