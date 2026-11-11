import type { BundleQuestion, SingleChoiceContent } from './question-content';

type SingleChoiceQuestion = BundleQuestion & { content: SingleChoiceContent };
import { findQuestionProblems, findRepeatedValues } from './question-rules';

const CATEGORIES = new Set(['world-cup']);

const validQuestion = (): SingleChoiceQuestion => ({
  externalKey: 'wc_winner:2010',
  content: {
    type: 'SINGLE_CHOICE',
    category: 'world-cup',
    difficulty: 2,
    locales: {
      en: { text: 'Which country won the 2010 World Cup?', explanation: null },
      ar: { text: 'أي منتخب فاز بكأس العالم 2010؟', explanation: null },
    },
    options: [
      { position: 1, isCorrect: true, entityRef: null, locales: { en: 'Spain', ar: 'إسبانيا' } },
      { position: 2, isCorrect: false, entityRef: null, locales: { en: 'Netherlands', ar: 'هولندا' } },
    ],
    validUntil: null,
  },
  provenance: { facts: [], sources: ['hand-written'], licenses: [], kbVersion: 'none' },
  reviewedLocales: ['en'],
});

const problemsAfter = (change: (question: SingleChoiceQuestion) => void): string[] => {
  const question = validQuestion();
  change(question);
  return findQuestionProblems(question, CATEGORIES);
};

describe('findQuestionProblems', () => {
  it('finds nothing wrong with a valid question', () => {
    expect(findQuestionProblems(validQuestion(), CATEGORIES)).toEqual([]);
  });

  it.each<[string, (question: SingleChoiceQuestion) => void, string]>([
    ['an unknown category', (q) => (q.content.category = 'chess'), 'not in the manifest'],
    ['difficulty 6', (q) => (q.content.difficulty = 6), 'difficulty'],
    ['no locales', (q) => (q.content.locales = {}), 'no locales'],
    ['an empty text', (q) => (q.content.locales.en = { text: '  ', explanation: null }), 'en text is empty'],
    ['a text that is too long', (q) => (q.content.locales.en = { text: 'x'.repeat(301), explanation: null }), 'longer'],
    ['one option', (q) => q.content.options.pop(), '2 to 6 options'],
    ['no correct option', (q) => (q.content.options[0].isCorrect = false), 'found 0'],
    ['two correct options', (q) => (q.content.options[1].isCorrect = true), 'found 2'],
    ['a gap in positions', (q) => (q.content.options[1].position = 3), 'positions'],
    ['an option missing a locale', (q) => delete q.content.options[1].locales.ar, 'option 2 must have text'],
    ['two options with the same text', (q) => (q.content.options[1].locales.en = ' spain'), 'same en text'],
    [
      'a review of a missing locale',
      (q) => {
        q.reviewedLocales = ['ar', 'en'];
        delete q.content.locales.ar;
        q.content.options.forEach((option) => delete option.locales.ar);
      },
      'humanReviewed',
    ],
    ['no source', (q) => (q.provenance.sources = []), 'source'],
  ])('reports %s', (_name, change, expected) => {
    expect(problemsAfter(change).join('\n')).toContain(expected);
  });

  it('accepts a question in one locale only', () => {
    expect(
      problemsAfter((q) => {
        delete q.content.locales.ar;
        q.content.options.forEach((option) => delete option.locales.ar);
      }),
    ).toEqual([]);
  });
});

describe('findRepeatedValues', () => {
  it('lists each repeated key once', () => {
    expect(findRepeatedValues(['a', 'b', 'a', 'a', 'c'])).toEqual(['a']);
  });
});
