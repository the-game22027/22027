import { Inject, Injectable } from '@nestjs/common';
import { isUuidV7 } from '@shared/kernel';
import { QuestionNotFoundError } from '../domain/question-bank-errors';
import { judgeTypedAnswer, type TypedAnswerVerdict } from '../domain/typed-answer';
import { QUESTION_READ_REPOSITORY, type QuestionReadRepository } from './ports/question-read-repository';

/** Judges a typed answer by entity id, never by text (08 §5.3). */
@Injectable()
export class AnswerChecker {
  constructor(@Inject(QUESTION_READ_REPOSITORY) private readonly questions: QuestionReadRepository) {}

  async checkTypedAnswer(contentId: string, slot: number, entityId: string): Promise<TypedAnswerVerdict> {
    // Every catalog id is a UUID v7; anything else cannot be an entity, and would make Postgres reject the cast.
    if (!isUuidV7(entityId)) return 'UNKNOWN_ENTITY';
    const lookup = await this.questions.lookUpTypedAnswer(contentId, slot, entityId);
    if (!lookup) throw new QuestionNotFoundError(contentId);
    return judgeTypedAnswer(lookup);
  }
}
