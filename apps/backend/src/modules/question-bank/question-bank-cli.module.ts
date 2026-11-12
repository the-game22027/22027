import { Module } from '@nestjs/common';
import { ImportQuestionBundle } from './application/import-question-bundle';
import { QUESTION_IMPORT_REPOSITORY } from './application/ports/question-import-repository';
import { QUESTION_REPORT_REPOSITORY } from './application/ports/question-report-repository';
import { QUESTION_STATUS_REPOSITORY } from './application/ports/question-status-repository';
import { QuestionReports } from './application/question-reports';
import { QuestionBankFacade } from './application/question-bank.facade';
import { PrismaQuestionImportRepository } from './infrastructure/prisma-question-import.repository';
import { PrismaQuestionReportRepository } from './infrastructure/prisma-question-report.repository';
import { PrismaQuestionStatusRepository } from './infrastructure/prisma-question-status.repository';
import { QuestionsDisableCommand } from './presentation/cli/questions-disable.command';
import { QuestionsImportCommand } from './presentation/cli/questions-import.command';
import { QuestionsPublishCommand } from './presentation/cli/questions-publish.command';
import { QuestionsReportsCommand } from './presentation/cli/questions-reports.command';

/** Content operations run from the CLI: import, publish, disable, read reports. */
@Module({
  providers: [
    ImportQuestionBundle,
    QuestionBankFacade,
    QuestionsImportCommand,
    QuestionsPublishCommand,
    QuestionsDisableCommand,
    QuestionReports,
    QuestionsReportsCommand,
    { provide: QUESTION_IMPORT_REPOSITORY, useClass: PrismaQuestionImportRepository },
    { provide: QUESTION_STATUS_REPOSITORY, useClass: PrismaQuestionStatusRepository },
    { provide: QUESTION_REPORT_REPOSITORY, useClass: PrismaQuestionReportRepository },
  ],
  exports: [ImportQuestionBundle, QuestionBankFacade],
})
export class QuestionBankCliModule {}
