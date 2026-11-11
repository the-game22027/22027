import { Inject, Injectable } from '@nestjs/common';
import type { EntityKind } from '../domain/question-content';
import {
  type CatalogEntityView,
  type CatalogSnapshot,
  QUESTION_READ_REPOSITORY,
  type QuestionReadRepository,
} from './ports/question-read-repository';

/** The version before any catalog was imported (08 §5.5). */
export const NO_CATALOG_VERSION = 'none';

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

  async findCurrentVersion(): Promise<string> {
    return (await this.questions.findCurrentCatalogVersion()) ?? NO_CATALOG_VERSION;
  }

  async getSnapshot(): Promise<CatalogSnapshot> {
    return (await this.questions.readCatalogSnapshot()) ?? { version: NO_CATALOG_VERSION, entities: [] };
  }
}
