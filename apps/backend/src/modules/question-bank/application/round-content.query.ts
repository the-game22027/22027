import { Inject, Injectable } from '@nestjs/common';
import type { Locale } from '@shared/kernel';
import { type EngineContent, listEntityReferencesOfBody, toEngineBody } from '../domain/engine-content';
import { QuestionNotFoundError } from '../domain/question-bank-errors';
import { QUESTION_READ_REPOSITORY, type QuestionReadRepository } from './ports/question-read-repository';

/** Full round content for the server-side engine (08 §5.4). Never sent to clients as is. */
@Injectable()
export class RoundContentQuery {
  constructor(@Inject(QUESTION_READ_REPOSITORY) private readonly questions: QuestionReadRepository) {}

  /** Any status: a battle keeps playing what it picked at creation, even if that content is disabled later. */
  async getContentForEngine(contentId: string, locales: readonly Locale[]): Promise<EngineContent> {
    const stored = await this.questions.findGameContent(contentId);
    if (!stored) throw new QuestionNotFoundError(contentId);
    const entityIds = await this.questions.findEntityIdsByExternalRefs(listEntityReferencesOfBody(stored.body));
    const answersBySlot = new Map<number, string[]>();
    for (const { slot, entityId } of stored.answers) {
      answersBySlot.set(slot, [...(answersBySlot.get(slot) ?? []), entityId]);
    }
    return {
      contentId: stored.id,
      gameType: stored.gameType,
      answerKind: stored.answerKind,
      difficulty: stored.difficulty,
      body: toEngineBody(stored.body, (ref) => entityIds.get(ref), locales),
      acceptedAnswers: [...answersBySlot]
        .sort(([slotA], [slotB]) => slotA - slotB)
        .map(([slot, ids]) => ({ slot, entityIds: ids })),
    };
  }
}
