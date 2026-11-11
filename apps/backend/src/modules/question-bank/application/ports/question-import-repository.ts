import type { Locale } from '@shared/kernel';
import type { CatalogEntity, KnownEntity } from '../../domain/answer-catalog';
import type { LatestQuestionVersion, QuestionStatus } from '../../domain/import-decision';
import type { BundleQuestion } from '../../domain/question-content';

export const QUESTION_IMPORT_REPOSITORY = Symbol('QUESTION_IMPORT_REPOSITORY');

export interface CategoryWrite {
  id: string;
  slug: string;
  names: { en: string; ar?: string };
}

export interface ImportBatchWrite {
  id: string;
  bundleVersion: string;
  checksum: string;
  catalogChecksum: string | null;
  generatorVersion: string;
  kbVersion: string;
  stats: Record<string, number>;
  importedAt: Date;
}

export interface ImportedBatchChecksums {
  checksum: string;
  catalogChecksum: string | null;
}

/** A catalog entity with the id it gets if it is new (an existing entity keeps its id). */
export type CatalogEntityWrite = CatalogEntity & { id: string };

/** An entity the import found in the active catalog. */
export type ActiveEntity = KnownEntity & { id: string };

/** A question row with its translations, options and accepted answers, ready to insert or to replace in place. */
export interface QuestionWrite {
  id: string;
  externalKey: string;
  keyVersion: number;
  contentHash: string;
  categoryId: string;
  status: QuestionStatus;
  question: BundleQuestion;
  /** One id per option, in the same order as the content's options (legacy multiple choice only). */
  optionIds: string[];
  /** Accepted answers of a game round, with catalog references already resolved to entity ids. */
  answerRows: { slot: number; entityId: string }[];
  importBatchId: string;
  at: Date;
}

export interface ReviewUpdate {
  questionId: string;
  newlyReviewedLocales: Locale[];
  approve: boolean;
}

export interface QuestionImportRepository {
  /** Serializes imports, so two bundles never decide against the same stale state. */
  waitForOtherImports(): Promise<void>;
  findBatchChecksums(bundleVersion: string): Promise<ImportedBatchChecksums | null>;
  insertBatch(batch: ImportBatchWrite): Promise<void>;
  /**
   * Makes the catalog exactly this list: new entities are added, existing ones updated (aliases replaced),
   * and active entities missing from the list are hidden, never deleted (battle history points at them).
   */
  replaceActiveCatalog(entities: readonly CatalogEntityWrite[], catalogVersion: string, at: Date): Promise<void>;
  findActiveEntities(externalRefs: readonly string[]): Promise<Map<string, ActiveEntity>>;
  /** Creates missing categories, renames existing ones; returns the id of every slug. */
  saveCategories(categories: readonly CategoryWrite[]): Promise<Map<string, string>>;
  findLatestVersions(externalKeys: readonly string[]): Promise<Map<string, LatestQuestionVersion>>;
  insertQuestions(questions: readonly QuestionWrite[]): Promise<void>;
  replaceContent(questions: readonly QuestionWrite[]): Promise<void>;
  recordReviews(updates: readonly ReviewUpdate[], at: Date): Promise<void>;
  disableQuestions(questionIds: readonly string[], reason: string, at: Date): Promise<void>;
}
