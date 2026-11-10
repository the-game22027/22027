import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { InvalidBundleError } from '../domain/question-bank-errors';
import { type BundleFiles, computeChecksum, parseBundle } from './bundle-parser';

const line = (externalKey = 'wc_winner:2010'): Record<string, unknown> => ({
  externalKey,
  type: 'SINGLE_CHOICE',
  category: 'world-cup',
  difficulty: 2,
  locales: { en: { text: 'Who won the 2010 World Cup?' } },
  options: [
    { position: 1, isCorrect: true, locales: { en: 'Spain' } },
    { position: 2, isCorrect: false, locales: { en: 'Netherlands' } },
  ],
  provenance: { facts: [], sources: ['hand-written'], licenses: [], kbVersion: 'none' },
  humanReviewed: { en: true },
});

const files = (lines: string[], manifest: Record<string, unknown> = {}): BundleFiles => {
  const questionsJsonl = Buffer.from(lines.map((text) => `${text}\n`).join(''));
  return {
    questionsJsonl,
    manifestJson: JSON.stringify({
      bundleVersion: 'dev-0001',
      kbVersion: 'none',
      generatorVersion: 'test',
      questionCount: lines.length,
      checksum: computeChecksum(questionsJsonl),
      categories: [{ slug: 'world-cup', names: { en: 'World Cup' } }],
      ...manifest,
    }),
  };
};

const problemsOf = (bundle: BundleFiles): string => {
  try {
    parseBundle(bundle);
  } catch (error) {
    if (error instanceof InvalidBundleError) return error.problems.join('\n');
    throw error;
  }
  throw new Error('expected the bundle to be invalid');
};

describe('parseBundle', () => {
  it('turns a valid bundle into questions', () => {
    const { manifest, questions } = parseBundle(files([JSON.stringify(line())]));
    expect(manifest.bundleVersion).toBe('dev-0001');
    expect(questions).toEqual([
      expect.objectContaining({
        externalKey: 'wc_winner:2010',
        reviewedLocales: ['en'],
        content: expect.objectContaining({
          locales: { en: { text: 'Who won the 2010 World Cup?', explanation: null } },
          validUntil: null,
        }) as unknown,
      }),
    ]);
  });

  it.each<[string, BundleFiles, string]>([
    ['a manifest that is not JSON', { ...files([]), manifestJson: '{' }, 'manifest.json is not valid JSON'],
    ['a wrong checksum', files([JSON.stringify(line())], { checksum: `sha256:${'0'.repeat(64)}` }), 'checksum'],
    ['a line that is not JSON', files(['{oops']), 'line 1: not valid JSON'],
    ['an unknown field', files([JSON.stringify({ ...line(), answer: 'Spain' })]), 'line 1: (root): Unrecognized key'],
    ['an unknown locale', files([JSON.stringify({ ...line(), locales: { fr: { text: 'Qui?' } } })]), 'line 1: locales'],
    ['a wrong question count', files([JSON.stringify(line())], { questionCount: 2 }), 'says 2 questions'],
    ['a repeated key', files([JSON.stringify(line()), JSON.stringify(line())]), 'appears more than once'],
    ['a broken rule', files([JSON.stringify({ ...line(), difficulty: 0 })]), 'line 1: difficulty'],
  ])('reports %s', (_name, bundle, expected) => {
    expect(problemsOf(bundle)).toContain(expected);
  });

  it('lists the problems of every line, not only the first', () => {
    const problems = problemsOf(files(['{oops', JSON.stringify({ ...line('b'), difficulty: 0 })]));
    expect(problems).toContain('line 1');
    expect(problems).toContain('line 2');
  });

  it('accepts the hand-written dev bundle in data/bundles', () => {
    const dir = join(process.cwd(), '../../data/bundles/dev-0001');
    const { questions } = parseBundle({
      manifestJson: readFileSync(join(dir, 'manifest.json'), 'utf8'),
      questionsJsonl: readFileSync(join(dir, 'questions.jsonl')),
    });
    expect(questions).toHaveLength(50);
  });
});
