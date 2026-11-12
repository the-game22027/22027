import { Inject, Injectable } from '@nestjs/common';
import { QuestionNotFoundError } from '../domain/question-bank-errors';
import { convertToMatchingForm } from '../domain/name-normalizer';
import {
  findClosestAcceptedAnswer,
  type TypedAnswerRules,
  type TypedTextJudgement,
} from '../domain/typed-text-judgement';
import { QUESTION_READ_REPOSITORY, type QuestionReadRepository } from './ports/question-read-repository';

/** Judges typed answers against the accepted answers of one slot only (08 §5.3, ADR-0021). */
@Injectable()
export class AnswerChecker {
  constructor(@Inject(QUESTION_READ_REPOSITORY) private readonly questions: QuestionReadRepository) {}

  /** `usedEntityIds`: grid players already on the board, which lose ties to unused ones. */
  async judgeTypedText(
    contentId: string,
    slot: number,
    text: string,
    rules: TypedAnswerRules,
    usedEntityIds: readonly string[] = [],
  ): Promise<TypedTextJudgement> {
    const form = convertToMatchingForm(text);
    if (form === '' || [...text].length > rules.maxLength) return { verdict: 'EMPTY' };
    const slotAnswers = await this.questions.findSlotAnswers(contentId, slot);
    if (!slotAnswers) throw new QuestionNotFoundError(contentId);
    const { candidates, roundAnswerKind } = slotAnswers;
    const closest = findClosestAcceptedAnswer(form, candidates, rules, usedEntityIds);
    if (closest?.edits === 0) return { verdict: 'CORRECT', entityId: closest.entityId, match: 'EXACT' };
    // Exactly another entity's name: a wrong answer, even when it is one typo away (تشابي is not تشافي).
    const acceptedIds = candidates.map((candidate) => candidate.entityId);
    const named = await this.questions.findEntityIdNamedExactly(roundAnswerKind, form, acceptedIds);
    if (named) return { verdict: 'WRONG', entityId: named, match: 'OTHER_ENTITY' };
    if (closest) return { verdict: 'CORRECT', entityId: closest.entityId, match: 'TYPO' };
    return { verdict: 'WRONG', entityId: null, match: 'NONE' };
  }
}
