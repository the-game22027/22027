import { Module } from '@nestjs/common';
import { AnswerCatalogQuery } from './application/answer-catalog.query';
import { AnswerChecker } from './application/answer-checker';
import { ContentSelector } from './application/content-selector';
import { LinkGraphQuery } from './application/link-graph.query';
import { QUESTION_READ_REPOSITORY } from './application/ports/question-read-repository';
import { QUESTION_REPORT_REPOSITORY } from './application/ports/question-report-repository';
import { QuestionReports } from './application/question-reports';
import { RoundContentQuery } from './application/round-content.query';
import { PrismaQuestionReadRepository } from './infrastructure/prisma-question-read.repository';
import { PrismaQuestionReportRepository } from './infrastructure/prisma-question-report.repository';

/** What the API process serves: content reads and answer judging for the battle engine (08 §5.4), and reports (08 §5.7). */
@Module({
  providers: [
    AnswerCatalogQuery,
    AnswerChecker,
    ContentSelector,
    LinkGraphQuery,
    RoundContentQuery,
    QuestionReports,
    { provide: QUESTION_READ_REPOSITORY, useClass: PrismaQuestionReadRepository },
    { provide: QUESTION_REPORT_REPOSITORY, useClass: PrismaQuestionReportRepository },
  ],
  exports: [AnswerCatalogQuery, AnswerChecker, ContentSelector, LinkGraphQuery, RoundContentQuery, QuestionReports],
})
export class QuestionBankModule {}
