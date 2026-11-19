import { Inject, Injectable } from '@nestjs/common';
import { isSupportedLocale } from '@shared/kernel';
import {
  type ContentFilter,
  type ContentSelectionCriteria,
  QUESTION_READ_REPOSITORY,
  type QuestionReadRepository,
} from './ports/question-read-repository';

const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0;

/** Picks the content of a new battle's rounds (03 §4.3, 08 §5.4). Called by `battles` at battle creation. */
@Injectable()
export class ContentSelector {
  constructor(@Inject(QUESTION_READ_REPOSITORY) private readonly questions: QuestionReadRepository) {}

  /** Up to `count` random content ids. Fewer means the bank is short (the caller refills, DEC-44). */
  async pickContentIds(criteria: ContentSelectionCriteria): Promise<string[]> {
    const problem = findFilterProblem(criteria);
    if (problem) throw new Error(`Invalid content selection criteria: ${problem}`);
    return this.questions.pickRandomContentIds(criteria);
  }

  /**
   * Up to `count` of the candidates that are still playable with this filter, in the candidates' order.
   * `battles` passes the players' seen questions, longest ago first, to refill a short bank (DEC-44).
   */
  async pickContentIdsInGivenOrder(filter: ContentFilter, candidateContentIds: readonly string[]): Promise<string[]> {
    const problem = findFilterProblem(filter);
    if (problem) throw new Error(`Invalid content selection criteria: ${problem}`);
    if (candidateContentIds.length === 0) return [];
    return this.questions.pickMatchingContentIdsInGivenOrder(filter, candidateContentIds);
  }
}

function findFilterProblem(criteria: ContentFilter): string | undefined {
  if (!isPositiveInteger(criteria.count)) return 'count must be a positive integer';
  if (criteria.locales.length === 0) return 'at least one locale is needed';
  if (criteria.locales.some((locale) => !isSupportedLocale(locale))) {
    return `unsupported locale in ${criteria.locales.join(', ')}`;
  }
  if (criteria.difficulties?.length === 0) return 'difficulties, when given, must not be empty';
  if (criteria.minAnswersPerSlot !== undefined && !isPositiveInteger(criteria.minAnswersPerSlot)) {
    return 'minAnswersPerSlot must be a positive integer';
  }
  return undefined;
}
