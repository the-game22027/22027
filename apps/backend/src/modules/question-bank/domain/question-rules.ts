import { type BundleQuestion, localesOfQuestion } from './question-content';

// Sanity bounds on stored text, not product rules: they stop a broken bundle from filling the UI.
export const MAX_QUESTION_TEXT_LENGTH = 300;
export const MAX_EXPLANATION_LENGTH = 600;
export const MAX_OPTION_TEXT_LENGTH = 100;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

const checkText = (problems: string[], field: string, value: string, maxLength: number): void => {
  if (value.trim() === '') problems.push(`${field} is empty`);
  else if (value.length > maxLength) problems.push(`${field} is longer than ${maxLength} characters`);
};

/** Every rule a question breaks, as readable messages. An empty list means the question is valid. */
export function findQuestionProblems(question: BundleQuestion, knownCategories: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const { content } = question;
  const locales = localesOfQuestion(content);

  if (!knownCategories.has(content.category)) problems.push(`category "${content.category}" is not in the manifest`);
  if (!Number.isInteger(content.difficulty) || content.difficulty < 1 || content.difficulty > 5) {
    problems.push('difficulty must be an integer from 1 to 5');
  }
  if (locales.length === 0) problems.push('the question has no locales');
  for (const locale of locales) {
    const localized = content.locales[locale];
    if (!localized) continue;
    checkText(problems, `${locale} text`, localized.text, MAX_QUESTION_TEXT_LENGTH);
    if (localized.explanation !== null) {
      checkText(problems, `${locale} explanation`, localized.explanation, MAX_EXPLANATION_LENGTH);
    }
  }

  const { options } = content;
  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
    problems.push(`a question needs ${MIN_OPTIONS} to ${MAX_OPTIONS} options`);
  }
  const positions = options.map((option) => option.position).sort((a, b) => a - b);
  if (positions.some((position, index) => position !== index + 1)) {
    problems.push('option positions must be 1, 2, 3, ... without gaps or repeats');
  }
  const correctCount = options.filter((option) => option.isCorrect).length;
  if (correctCount !== 1) problems.push(`exactly one option must be correct, found ${correctCount}`);

  for (const option of options) {
    const optionLocales = Object.keys(option.locales).sort();
    if (optionLocales.join() !== locales.join()) {
      problems.push(`option ${option.position} must have text in exactly these locales: ${locales.join(', ')}`);
    }
  }
  for (const locale of locales) {
    const normalized: string[] = [];
    for (const option of options) {
      const text = option.locales[locale];
      if (text === undefined) continue;
      checkText(problems, `option ${option.position} ${locale} text`, text, MAX_OPTION_TEXT_LENGTH);
      normalized.push(text.trim().toLocaleLowerCase(locale));
    }
    if (new Set(normalized).size !== normalized.length) problems.push(`two options have the same ${locale} text`);
  }

  const unknownReviewed = question.reviewedLocales.filter((locale) => !locales.includes(locale));
  if (unknownReviewed.length > 0) {
    problems.push(`humanReviewed names locales the question does not have: ${unknownReviewed.join(', ')}`);
  }
  if (question.provenance.sources.length === 0) problems.push('provenance needs at least one source');
  return problems;
}

/** External keys that appear more than once, each listed once. */
export function findRepeatedExternalKeys(keys: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) repeated.add(key);
    seen.add(key);
  }
  return [...repeated];
}
