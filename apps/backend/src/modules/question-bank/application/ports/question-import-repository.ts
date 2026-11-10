import type { Locale } from '@shared/kernel';
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
  generatorVersion: string;
  kbVersion: string;
  stats: Record<string, number>;
  importedAt: Date;
}

/** A question row with its translations and options, ready to insert or to replace content in place. */
export interface QuestionWrite {
  id: string;
  externalKey: string;
  keyVersion: number;
  contentHash: string;
  categoryId: string;
  status: QuestionStatus;
  question: BundleQuestion;
  /** One id per option, in the same order as `question.content.options`. */
  optionIds: string[];
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
  findBatchChecksum(bundleVersion: string): Promise<string | null>;
  insertBatch(batch: ImportBatchWrite): Promise<void>;
  /** Creates missing categories, renames existing ones; returns the id of every slug. */
  saveCategories(categories: readonly CategoryWrite[]): Promise<Map<string, string>>;
  findLatestVersions(externalKeys: readonly string[]): Promise<Map<string, LatestQuestionVersion>>;
  insertQuestions(questions: readonly QuestionWrite[]): Promise<void>;
  replaceContent(questions: readonly QuestionWrite[]): Promise<void>;
  recordReviews(updates: readonly ReviewUpdate[], at: Date): Promise<void>;
  disableQuestions(questionIds: readonly string[], reason: string, at: Date): Promise<void>;
}
