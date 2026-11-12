import { Module } from '@nestjs/common';
import { AnswerCatalogQuery } from './application/answer-catalog.query';
import { AnswerChecker } from './application/answer-checker';
import { ContentSelector } from './application/content-selector';
import { QUESTION_READ_REPOSITORY } from './application/ports/question-read-repository';
import { RoundContentQuery } from './application/round-content.query';
import { PrismaQuestionReadRepository } from './infrastructure/prisma-question-read.repository';

/** What the API process serves: content reads and answer judging for the battle engine (08 §5.4). */
@Module({
  providers: [
    AnswerCatalogQuery,
    AnswerChecker,
    ContentSelector,
    RoundContentQuery,
    { provide: QUESTION_READ_REPOSITORY, useClass: PrismaQuestionReadRepository },
  ],
  exports: [AnswerCatalogQuery, AnswerChecker, ContentSelector, RoundContentQuery],
})
export class QuestionBankModule {}
