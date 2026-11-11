export const QUESTION_STATUS_REPOSITORY = Symbol('QUESTION_STATUS_REPOSITORY');

/** Status changes made by operators (publish, disable), outside of an import. */
export interface QuestionStatusRepository {
  /** Takes the import lock: an import must never replace in place a question that is being published. */
  waitForOtherContentChanges(): Promise<void>;
  findBatchIdByBundleVersion(bundleVersion: string): Promise<string | null>;
  /** Publishes the batch's questions that have one of these statuses; returns how many became PUBLISHED. */
  publishQuestionsOfBatch(batchId: string, statuses: readonly ('DRAFT' | 'APPROVED')[], at: Date): Promise<number>;
  countDraftQuestionsOfBatch(batchId: string): Promise<number>;
  /** Returns false when the question was already disabled. */
  disableQuestionIfEnabled(questionId: string, reason: string, at: Date): Promise<boolean>;
  questionExists(questionId: string): Promise<boolean>;
}
