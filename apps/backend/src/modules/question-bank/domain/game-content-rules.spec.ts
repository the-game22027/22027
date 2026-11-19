import type { KnownEntity } from './answer-catalog';
import { type BundleQuestion, computeContentHash, type GameContent, localesOfQuestion } from './question-content';
import { findCatalogReferenceProblems, findQuestionProblems } from './question-rules';

type GameQuestion = BundleQuestion & { content: GameContent };
const CATEGORIES = new Set(['players']);

const question = (content: Omit<GameContent, 'type' | 'category' | 'difficulty' | 'validUntil'>): GameQuestion => ({
  externalKey: 'test',
  content: { type: 'GAME', category: 'players', difficulty: 2, validUntil: null, ...content },
  provenance: { facts: [], sources: ['test'], licenses: [], kbVersion: 'none' },
  reviewedLocales: [],
});

const buzzer = () =>
  question({
    body: {
      gameType: 'BUZZER',
      answerKind: 'NATIONAL_TEAM',
      steps: { en: ['Which country', 'won in 2010?'], ar: ['أي منتخب', 'فاز في 2010؟'] },
      explanation: null,
      answerNumber: null,
    },
    answers: [{ slot: 0, entities: ['wd:spain'] }],
  });

const career = () =>
  question({
    body: {
      gameType: 'CAREER',
      player: 'wd:ronaldo',
      spells: [
        { club: 'wd:sporting', fromYear: 2002, toYear: 2003, loan: false },
        { club: 'wd:united', fromYear: 2003, toYear: 2009, loan: false },
      ],
    },
    answers: [{ slot: 0, entities: ['wd:ronaldo'] }],
  });

const grid = () =>
  question({
    body: {
      gameType: 'GRID',
      rows: ['wd:real', 'wd:barca', 'wd:juve'].map((entity) => ({ kind: 'CLUB' as const, entity })),
      cols: ['wd:brazil', 'wd:france', 'wd:argentina'].map((entity) => ({ kind: 'NATIONALITY' as const, entity })),
    },
    answers: Array.from({ length: 9 }, (_, slot) => ({ slot, entities: [`wd:player${slot}`] })),
  });

const problemsOf = (q: GameQuestion) => findQuestionProblems(q, CATEGORIES).join('\n');

describe('game content shape', () => {
  it('accepts a mines category of a club plus a citizenship or a decade, with one slot of players', () => {
    const mines = (second: object, entities = ['wd:ronaldo', 'wd:nani']) =>
      question({
        body: { gameType: 'MINES', criteria: [{ kind: 'CLUB', entity: 'wd:united' }, second] } as GameContent['body'],
        answers: [{ slot: 0, entities }],
      });
    expect(problemsOf(mines({ kind: 'NATIONALITY', entity: 'wd:portugal' }))).toBe('');
    expect(problemsOf(mines({ kind: 'DECADE', fromYear: 2000 }))).toBe('');
    expect(problemsOf(mines({ kind: 'DECADE', fromYear: 2005 }))).toContain(
      'a DECADE criterion starts at a year ending in 0',
    );
    expect(problemsOf(mines({ kind: 'CLUB', entity: 'wd:city' }))).toContain('a mines category is a CLUB criterion');
    expect(problemsOf(mines({ kind: 'DECADE', fromYear: 2000 }, []))).toContain('exactly one slot 0');
    expect(localesOfQuestion(mines({ kind: 'DECADE', fromYear: 2000 }).content)).toEqual(['ar', 'en']);
  });

  it('accepts an auction round of 3 titled lists with one slot of names each', () => {
    const list = (name: string) => ({ kind: 'SCORERS', title: { en: `${name} scorers`, ar: `هدافو ${name}` } });
    const auction = (lists = [list('a'), list('b'), list('c')], slots = 3) =>
      question({
        body: { gameType: 'AUCTION', lists },
        answers: Array.from({ length: slots }, (_, slot) => ({ slot, entities: ['wd:ronaldo'] })),
      });
    expect(problemsOf(auction())).toBe('');
    expect(problemsOf(auction([list('a'), list('b')]))).toContain('an auction round offers 3 lists');
    expect(problemsOf(auction(undefined, 2))).toContain('auction list 3 has no names');
    expect(problemsOf(auction([list('a'), list('b'), { kind: 'SCORERS', title: { en: 'only english' } }]))).toContain(
      'list 3 must have a title in exactly the locales of list 1',
    );
    expect(localesOfQuestion(auction().content)).toEqual(['ar', 'en']);
  });

  it('accepts a valid buzzer, career and grid', () => {
    expect([buzzer(), career(), grid()].map((q) => findQuestionProblems(q, CATEGORIES))).toEqual([[], [], []]);
  });

  it('requires the same number of reveal steps in every locale', () => {
    const q = buzzer();
    if (q.content.body.gameType === 'BUZZER') q.content.body.steps.ar = ['أي منتخب فاز في 2010؟'];
    expect(problemsOf(q)).toContain('same number of steps');
  });

  it('requires a NUMBER buzzer to carry its number and no entities', () => {
    const q = buzzer();
    if (q.content.body.gameType === 'BUZZER') q.content.body.answerKind = 'NUMBER';
    expect(problemsOf(q)).toContain('needs answerNumber');
    expect(problemsOf(q)).toContain('takes no answer entities');
  });

  it('requires the career player to be an accepted answer, and spells in date order', () => {
    const q = career();
    q.content.answers = [{ slot: 0, entities: ['wd:nani'] }];
    if (q.content.body.gameType === 'CAREER') q.content.body.spells.reverse();
    expect(problemsOf(q)).toContain('player must be one of the accepted answers');
    expect(problemsOf(q)).toContain('out of date order');
  });

  it('requires every grid cell to have a valid player', () => {
    const q = grid();
    q.content.answers = q.content.answers.filter((answer) => answer.slot !== 4);
    expect(problemsOf(q)).toContain('grid cell 4 has no valid player');
  });

  it('plays career and grid in every locale, a buzzer only in the locales it has text for', () => {
    const q = buzzer();
    if (q.content.body.gameType === 'BUZZER') delete q.content.body.steps.ar;
    expect(localesOfQuestion(q.content)).toEqual(['en']);
    expect(localesOfQuestion(career().content)).toEqual(['ar', 'en']);
  });
});

describe('catalog references', () => {
  const catalog: Record<string, KnownEntity> = {
    'wd:spain': { kind: 'NATIONAL_TEAM', names: { en: 'Spain', ar: 'إسبانيا' } },
    'wd:ronaldo': { kind: 'PLAYER', names: { en: 'Cristiano Ronaldo', ar: 'كريستيانو رونالدو' } },
    'wd:sporting': { kind: 'CLUB', names: { en: 'Sporting CP', ar: 'سبورتنج' } },
    'wd:united': { kind: 'PLAYER', names: { en: 'Not a club', ar: 'ليس ناديا' } },
  };
  const find = (ref: string) => catalog[ref];

  it('reports missing entities and wrong kinds', () => {
    const problems = findCatalogReferenceProblems(career().content, find).join('\n');
    expect(problems).toContain('spell 2 club wd:united is a PLAYER, expected CLUB');
    expect(findCatalogReferenceProblems(grid().content, find)[0]).toContain('is not in the answer catalog');
  });

  it('reports a buzzer whose text contains the answer name, in any locale', () => {
    const q = buzzer();
    if (q.content.body.gameType === 'BUZZER') q.content.body.steps.ar = ['هل فازت', 'إسبانيا في 2010؟'];
    expect(findCatalogReferenceProblems(q.content, find)).toEqual(['the ar question gives away the answer "إسبانيا"']);
  });
});

describe('content hash of game content', () => {
  it('ignores the order of answer slots and of entities inside a slot', () => {
    const a = grid();
    const b = grid();
    b.content.answers = [...b.content.answers].reverse();
    b.content.answers[0] = { slot: b.content.answers[0].slot, entities: ['wd:x', 'wd:player8'] };
    a.content.answers[8] = { slot: 8, entities: ['wd:player8', 'wd:x'] };
    expect(computeContentHash(b.content)).toBe(computeContentHash(a.content));
  });

  it('changes when an accepted answer is added', () => {
    const a = career();
    const b = career();
    b.content.answers[0].entities.push('wd:nani');
    expect(computeContentHash(b.content)).not.toBe(computeContentHash(a.content));
  });
});
