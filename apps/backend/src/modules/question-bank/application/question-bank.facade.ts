import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { OutboxWriter } from '@shared/infrastructure/outbox';
import { CLOCK, type Clock, isUuidV7 } from '@shared/kernel';
import {
  BundleNotImportedError,
  InvalidDisableReasonError,
  QuestionNotFoundError,
} from '../domain/question-bank-errors';
import { QUESTION_STATUS_REPOSITORY, type QuestionStatusRepository } from './ports/question-status-repository';

// A sanity bound so a reason stays a reason, not a document.
const MAX_DISABLE_REASON_LENGTH = 500;

export interface PublishSummary {
  publishedCount: number;
  /** DRAFT questions of the bundle: they need a review before they can be published. */
  waitingForReviewCount: number;
}

/** Operator actions on content (08 §5.6). */
@Injectable()
export class QuestionBankFacade {
  constructor(
    @Inject(QUESTION_STATUS_REPOSITORY) private readonly questions: QuestionStatusRepository,
    private readonly outbox: OutboxWriter,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Publishes a bundle's APPROVED questions. `includeDrafts` also publishes unreviewed ones: development
   * bundles only, which the CLI enforces (07 §5.8).
   */
  @Transactional()
  async publishQuestionsOfBundle(bundleVersion: string, { includeDrafts = false } = {}): Promise<PublishSummary> {
    await this.questions.waitForOtherContentChanges();
    const batchId = await this.questions.findBatchIdByBundleVersion(bundleVersion);
    if (!batchId) throw new BundleNotImportedError(bundleVersion);
    const statuses = includeDrafts ? (['APPROVED', 'DRAFT'] as const) : (['APPROVED'] as const);
    const publishedCount = await this.questions.publishQuestionsOfBatch(batchId, statuses, this.clock.now());
    if (publishedCount > 0) {
      await this.outbox.write({
        type: 'QuestionsPublished',
        version: 1,
        aggregateType: 'question_import_batch',
        aggregateId: batchId,
        payload: { batchId, publishedCount },
      });
    }
    return { publishedCount, waitingForReviewCount: await this.questions.countDraftQuestionsOfBatch(batchId) };
  }

  /** Returns false when the question was already disabled (nothing changes then). */
  @Transactional()
  async disableQuestion(questionId: string, reason: string): Promise<boolean> {
    const trimmedReason = reason.trim();
    if (trimmedReason.length === 0 || trimmedReason.length > MAX_DISABLE_REASON_LENGTH) {
      throw new InvalidDisableReasonError(MAX_DISABLE_REASON_LENGTH);
    }
    if (!isUuidV7(questionId)) throw new QuestionNotFoundError(questionId);
    await this.questions.waitForOtherContentChanges();
    const disabled = await this.questions.disableQuestionIfEnabled(questionId, trimmedReason, this.clock.now());
    if (!disabled) {
      if (!(await this.questions.questionExists(questionId))) throw new QuestionNotFoundError(questionId);
      return false;
    }
    await this.outbox.write({
      type: 'QuestionDisabled',
      version: 1,
      aggregateType: 'question',
      aggregateId: questionId,
      payload: { questionId, reason: trimmedReason },
    });
    return true;
  }
}
