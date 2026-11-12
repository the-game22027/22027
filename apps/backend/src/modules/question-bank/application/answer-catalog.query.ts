import { Inject, Injectable } from '@nestjs/common';
import type { EntityKind } from '../domain/question-content';
import {
  type CatalogEntityView,
  QUESTION_READ_REPOSITORY,
  type QuestionReadRepository,
} from './ports/question-read-repository';

@Injectable()
export class AnswerCatalogQuery {
  constructor(@Inject(QUESTION_READ_REPOSITORY) private readonly questions: QuestionReadRepository) {}

  /** Names in both locales: one battle can have players of both languages. */
  findEntitiesByIds(entityIds: readonly string[]): Promise<CatalogEntityView[]> {
    if (entityIds.length === 0) return Promise.resolve([]);
    return this.questions.findEntitiesByIds(entityIds);
  }

  /** Plausible wrong answers: popular entities of the same kind that are not accepted (bots, 08 §3.3). */
  findDecoyEntityIds(kind: EntityKind, acceptedIds: readonly string[], limit: number): Promise<string[]> {
    return this.questions.findPopularEntityIdsOfKind(kind, acceptedIds, limit);
  }
}
