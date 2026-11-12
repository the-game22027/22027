import { convertToMatchingForm } from './name-normalizer';
import {
  type AnswerCandidate,
  countAllowedEditsForForm,
  countEditsUpTo,
  findClosestAcceptedAnswer,
  listFormsOfCandidate,
  type TypedAnswerRules,
} from './typed-text-judgement';

const rules: TypedAnswerRules = {
  maxLength: 60,
  typoTolerance: [
    { fromLetters: 0, edits: 0 },
    { fromLetters: 4, edits: 1 },
    { fromLetters: 8, edits: 2 },
  ],
  singleWordMaxSharedBy: 2,
};

const messi: AnswerCandidate = {
  entityId: 'messi',
  popularity: 300,
  searchForms: ['lionel messi', 'ليونيل ميسي', 'ليو ميسي'],
  nameWords: [
    { form: 'ليونيل', sharedBy: 2 },
    { form: 'ميسي', sharedBy: 1 },
    { form: 'lionel', sharedBy: 2 },
    { form: 'messi', sharedBy: 1 },
  ],
};

const salah: AnswerCandidate = {
  entityId: 'salah',
  popularity: 200,
  searchForms: ['محمد صلاح', 'mohamed salah'],
  nameWords: [
    { form: 'محمد', sharedBy: 140 },
    { form: 'صلاح', sharedBy: 2 },
  ],
};

const judge = (typed: string, candidates = [messi], used: string[] = []) =>
  findClosestAcceptedAnswer(convertToMatchingForm(typed), candidates, rules, used);

describe('findClosestAcceptedAnswer (08 §5.3)', () => {
  it.each(['ميسي', 'ليونيل', 'Lionel Messi', 'ليونيل ميسى'])('accepts %s exactly', (typed) => {
    expect(judge(typed)).toEqual({ entityId: 'messi', edits: 0 });
  });

  it.each(['ميسب', 'مبسي', 'ميسيي', 'مسيي', 'mesi'])('accepts the one-typo %s', (typed) => {
    expect(judge(typed)).toEqual({ entityId: 'messi', edits: 1 });
  });

  it('accepts two typos in a long name, not three', () => {
    expect(judge('ليونل ميسى')).toEqual({ entityId: 'messi', edits: 1 });
    expect(judge('ليونل مسي')).toEqual({ entityId: 'messi', edits: 2 });
    expect(judge('لونل مسي')).toBeNull();
  });

  it('refuses a common first name alone, but accepts a distinctive one', () => {
    expect(judge('محمد', [salah])).toBeNull();
    expect(judge('صلاح', [salah])).toEqual({ entityId: 'salah', edits: 0 });
  });

  it('allows no typo in a name of 3 letters or fewer', () => {
    const pele: AnswerCandidate = { entityId: 'pele', popularity: 1, searchForms: ['بيل'], nameWords: [] };
    expect(judge('بيل', [pele])).toEqual({ entityId: 'pele', edits: 0 });
    expect(judge('بيك', [pele])).toBeNull();
  });

  it('prefers the closest, then an unused player, then the most popular (grid)', () => {
    const ronaldo = (entityId: string, popularity: number): AnswerCandidate => ({
      entityId,
      popularity,
      searchForms: [`${entityId} ronaldo`],
      nameWords: [{ form: 'ronaldo', sharedBy: 2 }],
    });
    const players = [ronaldo('cristiano', 400), ronaldo('nazario', 300)];
    expect(judge('ronaldo', players)).toEqual({ entityId: 'cristiano', edits: 0 });
    expect(judge('ronaldo', players, ['cristiano'])).toEqual({ entityId: 'nazario', edits: 0 });
    expect(judge('cristiano ronaldo', players, ['cristiano'])).toEqual({ entityId: 'cristiano', edits: 0 });
  });
});

describe('countEditsUpTo', () => {
  it.each([
    ['ميسي', 'ميسي', 0],
    ['ميسب', 'ميسي', 1],
    ['ميسيي', 'ميسي', 1],
    ['مسيي', 'ميسي', 1],
    ['abc', 'cba', 2],
  ])('counts %s → %s as %i', (a, b, edits) => {
    expect(countEditsUpTo(a, b, 5)).toBe(edits);
  });

  it('stops at maxEdits + 1', () => {
    expect(countEditsUpTo('abcdef', 'uvwxyz', 1)).toBe(2);
    expect(countEditsUpTo('a', 'abcdef', 2)).toBe(3);
  });
});

describe('typo tolerance by letter count', () => {
  it.each([
    ['بيل', 0],
    ['ميسي', 1],
    ['ليونيل', 1],
    ['ليو ميسي', 1],
    ['ليونيل ميسي', 2],
  ])('%s allows %i edits', (form, edits) => {
    expect(countAllowedEditsForForm(form, rules)).toBe(edits);
  });

  it('follows the configured steps', () => {
    const strict = { ...rules, typoTolerance: [{ fromLetters: 6, edits: 1 }] };
    expect(countAllowedEditsForForm('ميسي', strict)).toBe(0);
    expect(countAllowedEditsForForm('ليونيل', strict)).toBe(1);
  });

  it('lists distinctive name words as forms, once', () => {
    expect(listFormsOfCandidate(salah, rules)).toEqual(['محمد صلاح', 'mohamed salah', 'صلاح']);
    expect(listFormsOfCandidate(salah, { ...rules, singleWordMaxSharedBy: 200 })).toContain('محمد');
  });
});
