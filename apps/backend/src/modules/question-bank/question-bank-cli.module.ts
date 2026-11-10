import { Module } from '@nestjs/common';
import { ImportQuestionBundle } from './application/import-question-bundle';
import { QUESTION_IMPORT_REPOSITORY } from './application/ports/question-import-repository';
import { PrismaQuestionImportRepository } from './infrastructure/prisma-question-import.repository';
import { QuestionsImportCommand } from './presentation/cli/questions-import.command';

/** Content operations run from the CLI (import now; publish and disable in P5.2). */
@Module({
  providers: [
    ImportQuestionBundle,
    QuestionsImportCommand,
    { provide: QUESTION_IMPORT_REPOSITORY, useClass: PrismaQuestionImportRepository },
  ],
  exports: [ImportQuestionBundle],
})
export class QuestionBankCliModule {}
