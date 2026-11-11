import { Inject, Injectable } from '@nestjs/common';
import { isSupportedLocale } from '@shared/kernel';
import {
  type ContentSelectionCriteria,
  QUESTION_READ_REPOSITORY,
  type QuestionReadRepository,
} from './ports/question-read-repository';

const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0;

/** Picks the content of a new battle's rounds (03 §4.3, 08 §5.4). Called by `battles` at battle creation. */
@Injectable()
export class ContentSelector {
  constructor(@Inject(QUESTION_READ_REPOSITORY) private readonly questions: QuestionReadRepository) {}

  /**
   * Up to `count` random content ids. Fewer means the bank is short: the caller relaxes its exposure
   * window and asks again (DEC-44).
   */
  async pickContentIds(criteria: ContentSelectionCriteria): Promise<string[]> {
    const problem = findCriteriaProblem(criteria);
    if (problem) throw new Error(`Invalid content selection criteria: ${problem}`);
    return this.questions.pickRandomContentIds(criteria);
  }
}

function findCriteriaProblem(criteria: ContentSelectionCriteria): string | undefined {
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
