import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import type {
  NewQuestionReport,
  QuestionReportRepository,
  ReportedQuestion,
} from '../application/ports/question-report-repository';

@Injectable()
export class PrismaQuestionReportRepository implements QuestionReportRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {}

  async saveReportIfNew(report: NewQuestionReport): Promise<boolean> {
    const { count } = await this.txHost.tx.questionReport.createMany({ data: [report], skipDuplicates: true });
    return count === 1;
  }

  async listMostReportedQuestions(limit: number, reasonsPerQuestion: number): Promise<ReportedQuestion[]> {
    return this.txHost.tx.$queryRaw<ReportedQuestion[]>`
      SELECT q.id::text AS "questionId", q.external_key AS "externalKey", q.status::text AS status,
             count(*)::int AS "reportCount",
             (array_agg(r.reason ORDER BY r.created_at DESC))[1:${reasonsPerQuestion}] AS "latestReasons"
      FROM question_reports r
      JOIN questions q ON q.id = r.question_id
      GROUP BY q.id
      ORDER BY count(*) DESC, max(r.created_at) DESC
      LIMIT ${limit}`;
  }
}
