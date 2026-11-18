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

describe('parseBundle with game content and a catalog', () => {
  const catalogLine = (externalRef: string, kind = 'PLAYER', extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      externalRef,
      kind,
      names: { en: 'Cristiano Ronaldo', ar: 'كريستيانو رونالدو' },
      aliases: { en: ['CR7'], ar: [] },
      popularity: 400,
      search: ['cristiano ronaldo', 'cr7'],
      ...extra,
    });
  const careerLine = (content: Record<string, unknown> = {}) =>
    JSON.stringify({
      externalKey: 'career:ronaldo',
      type: 'GAME',
      gameType: 'CAREER',
      category: 'world-cup',
      difficulty: 1,
      content: {
        player: 'wikidata:Q11571',
        spells: [
          { club: 'wikidata:Q75729', fromYear: 2002, toYear: 2003 },
          { club: 'wikidata:Q18656', fromYear: 2003, toYear: 2009, loan: false },
        ],
        ...content,
      },
      answers: [{ slot: 0, entities: ['wikidata:Q11571'] }],
      provenance: { facts: [], sources: ['wikidata'], licenses: ['CC0-1.0'], kbVersion: 'none' },
      humanReviewed: { en: true, ar: true },
    });
  const withCatalog = (questionLines: string[], catalogLines: string[], manifest: Record<string, unknown> = {}) => {
    const catalogJsonl = Buffer.from(catalogLines.map((text) => `${text}\n`).join(''));
    return { ...files(questionLines, { catalogChecksum: computeChecksum(catalogJsonl), ...manifest }), catalogJsonl };
  };

  it('reads game lines and the catalog', () => {
    const { questions, catalog } = parseBundle(withCatalog([careerLine()], [catalogLine('wikidata:Q11571')]));
    expect(questions[0].content).toMatchObject({
      type: 'GAME',
      body: { gameType: 'CAREER', spells: [{ loan: false }, { loan: false }] },
    });
    expect(catalog).toEqual([
      expect.objectContaining({ externalRef: 'wikidata:Q11571', searchForms: ['cristiano ronaldo', 'cr7'] }),
    ]);
  });

  it('reads name words, and gives none to a catalog made before them (ADR-0021)', () => {
    const nameWords = [{ form: 'cristiano', sharedBy: 1 }];
    const { catalog } = parseBundle(
      withCatalog(
        [careerLine()],
        [catalogLine('wikidata:Q11571', 'PLAYER', { nameWords }), catalogLine('wikidata:Q1', 'PLAYER')],
      ),
    );
    expect(catalog.map((entity) => entity.nameWords)).toEqual([nameWords, []]);
  });

  it('reports problems inside the game content with their path', () => {
    expect(problemsOf(files([careerLine({ player: 'not a ref' })]))).toContain('line 1: content.player');
  });

  it('reports a catalog that does not match its checksum, a repeated entity and a NUMBER entity', () => {
    const bundle = withCatalog([careerLine()], [catalogLine('wikidata:Q1'), catalogLine('wikidata:Q1')], {
      catalogChecksum: `sha256:${'0'.repeat(64)}`,
    });
    const problems = problemsOf(bundle);
    expect(problems).toContain('catalog.jsonl does not match the manifest catalogChecksum');
    expect(problems).toContain('wikidata:Q1 appears more than once');
    expect(problemsOf(withCatalog([careerLine()], [catalogLine('wikidata:Q2', 'NUMBER')]))).toContain('kind');
  });

  it('requires the catalog file and its checksum to come together', () => {
    const catalogJsonl = Buffer.from(`${catalogLine('wikidata:Q1')}\n`);
    expect(problemsOf({ ...files([careerLine()]), catalogJsonl })).toContain('has no catalogChecksum');
    expect(problemsOf(files([careerLine()], { catalogChecksum: computeChecksum(catalogJsonl) }))).toContain(
      'has no catalog.jsonl',
    );
  });
});
