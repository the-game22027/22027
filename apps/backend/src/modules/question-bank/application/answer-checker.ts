import { Inject, Injectable } from '@nestjs/common';
import { PASS_TYPE_ENDS } from '../domain/link-graph';
import { QuestionNotFoundError } from '../domain/question-bank-errors';
import type { AnswerKind } from '../domain/question-content';
import { convertToMatchingForm } from '../domain/name-normalizer';
import {
  type AnswerCandidate,
  findClosestAcceptedAnswer,
  type TypedAnswerRules,
  type TypedTextJudgement,
} from '../domain/typed-text-judgement';
import type { LinkedAnswers } from './link-graph.query';
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
    return this.judgeAgainstCandidates(form, slotAnswers.candidates, slotAnswers.roundAnswerKind, rules, usedEntityIds);
  }

  /**
   * Judges a ONE_TWO answer against the ball's neighbours for the picked pass type, loaded when the pass was made
   * (08 §15.7). The same rules as a slot: comparing with the neighbours only settles most same-name cases.
   */
  async judgeTypedTextAgainstLinks(
    linked: LinkedAnswers,
    text: string,
    rules: TypedAnswerRules,
    usedEntityIds: readonly string[] = [],
  ): Promise<TypedTextJudgement> {
    const form = convertToMatchingForm(text);
    if (form === '' || [...text].length > rules.maxLength) return { verdict: 'EMPTY' };
    const kind: AnswerKind = PASS_TYPE_ENDS[linked.passType].answer;
    return this.judgeAgainstCandidates(form, linked.answers, kind, rules, usedEntityIds);
  }

  private async judgeAgainstCandidates(
    form: string,
    candidates: readonly AnswerCandidate[],
    roundAnswerKind: AnswerKind,
    rules: TypedAnswerRules,
    usedEntityIds: readonly string[],
  ): Promise<TypedTextJudgement> {
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
