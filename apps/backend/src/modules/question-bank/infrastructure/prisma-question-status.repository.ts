import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import type { QuestionStatusRepository } from '../application/ports/question-status-repository';
import { takeContentChangeLock } from './content-change-lock';

@Injectable()
export class PrismaQuestionStatusRepository implements QuestionStatusRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {}

  async waitForOtherContentChanges(): Promise<void> {
    await takeContentChangeLock(this.txHost.tx);
  }

  async findBatchIdByBundleVersion(bundleVersion: string): Promise<string | null> {
    const batch = await this.txHost.tx.questionImportBatch.findUnique({
      where: { bundleVersion },
      select: { id: true },
    });
    return batch?.id ?? null;
  }

  async publishQuestionsOfBatch(
    batchId: string,
    statuses: readonly ('DRAFT' | 'APPROVED')[],
    at: Date,
  ): Promise<number> {
    const { count } = await this.txHost.tx.question.updateMany({
      where: { importBatchId: batchId, status: { in: [...statuses] } },
      data: { status: 'PUBLISHED', publishedAt: at, updatedAt: at },
    });
    return count;
  }

  countDraftQuestionsOfBatch(batchId: string): Promise<number> {
    return this.txHost.tx.question.count({ where: { importBatchId: batchId, status: 'DRAFT' } });
  }

  async disableQuestionIfEnabled(questionId: string, reason: string, at: Date): Promise<boolean> {
    const { count } = await this.txHost.tx.question.updateMany({
      where: { id: questionId, status: { not: 'DISABLED' } },
      data: { status: 'DISABLED', disabledAt: at, disabledReason: reason, updatedAt: at },
    });
    return count > 0;
  }

  async questionExists(questionId: string): Promise<boolean> {
    return (await this.txHost.tx.question.count({ where: { id: questionId } })) > 0;
  }
}
