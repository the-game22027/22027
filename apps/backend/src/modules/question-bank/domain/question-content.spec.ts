import { computeContentHash, type QuestionContent } from './question-content';

const content = (): QuestionContent => ({
  type: 'SINGLE_CHOICE',
  category: 'world-cup',
  difficulty: 2,
  locales: { en: { text: 'Who won the 2010 World Cup?', explanation: null } },
  options: [
    { position: 1, isCorrect: true, entityRef: null, locales: { en: 'Spain' } },
    { position: 2, isCorrect: false, entityRef: null, locales: { en: 'Netherlands' } },
  ],
  validUntil: null,
});

describe('computeContentHash', () => {
  it('ignores the order of keys and options', () => {
    const reordered = content();
    reordered.options.reverse();
    const { type, ...rest } = reordered;
    expect(computeContentHash({ ...rest, type })).toBe(computeContentHash(content()));
  });

  it('treats the same instant written two ways as equal', () => {
    const a = { ...content(), validUntil: new Date('2030-01-01T00:00:00Z') };
    const b = { ...content(), validUntil: new Date('2030-01-01T00:00:00.000Z') };
    expect(computeContentHash(a)).toBe(computeContentHash(b));
  });

  it.each<[string, (value: QuestionContent) => void]>([
    ['the text', (value) => (value.locales.en = { text: 'Who won in 2010?', explanation: null })],
    ['the correct option', (value) => value.options.forEach((option) => (option.isCorrect = !option.isCorrect))],
    ['the difficulty', (value) => (value.difficulty = 3)],
    ['the expiry', (value) => (value.validUntil = new Date('2030-01-01T00:00:00Z'))],
  ])('changes when %s changes', (_name, change) => {
    const changed = content();
    change(changed);
    expect(computeContentHash(changed)).not.toBe(computeContentHash(content()));
  });
});
