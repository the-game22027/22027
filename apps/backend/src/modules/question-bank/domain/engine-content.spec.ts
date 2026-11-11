import { listEntityReferencesOfBody, toEngineBody } from './engine-content';
import type { GameBody } from './question-content';

const ids = new Map([
  ['wd:ronaldo', 'id-ronaldo'],
  ['wd:sporting', 'id-sporting'],
  ['wd:united', 'id-united'],
  ['wd:spain', 'id-spain'],
]);
const idOf = (ref: string) => ids.get(ref);

const career: GameBody = {
  gameType: 'CAREER',
  player: 'wd:ronaldo',
  spells: [
    { club: 'wd:sporting', fromYear: 2002, toYear: 2003, loan: false },
    { club: 'wd:united', fromYear: 2003, toYear: null, loan: true },
  ],
};

const buzzer: GameBody = {
  gameType: 'BUZZER',
  answerKind: 'NATIONAL_TEAM',
  steps: { en: ['Which country', 'won 2010?'], ar: ['أي منتخب', 'فاز 2010؟'] },
  explanation: { en: 'Spain beat the Netherlands.' },
  answerNumber: null,
};

describe('the engine view of stored content', () => {
  it('turns every catalog reference of a career into an entity id', () => {
    expect(toEngineBody(career, idOf, ['ar', 'en'])).toEqual({
      gameType: 'CAREER',
      playerEntityId: 'id-ronaldo',
      spells: [
        { clubEntityId: 'id-sporting', fromYear: 2002, toYear: 2003, loan: false },
        { clubEntityId: 'id-united', fromYear: 2003, toYear: null, loan: true },
      ],
    });
  });

  it("keeps only the battle's locales, and an explanation only where it exists", () => {
    const body = toEngineBody(buzzer, idOf, ['ar']);
    expect(body).toMatchObject({ steps: { ar: ['أي منتخب', 'فاز 2010؟'] }, explanation: {} });
    expect(toEngineBody(buzzer, idOf, ['en'])).toMatchObject({ explanation: { en: 'Spain beat the Netherlands.' } });
  });

  it('fails loudly when content lacks a locale or points outside the catalog', () => {
    const englishOnly: GameBody = { ...buzzer, steps: { en: ['a', 'b'] } };
    expect(() => toEngineBody(englishOnly, idOf, ['ar'])).toThrow('no text in locale ar');
    const unknownPlayer: GameBody = { ...career, player: 'wd:nobody' };
    expect(() => toEngineBody(unknownPlayer, idOf, ['en'])).toThrow('wd:nobody');
  });

  it('turns grid criteria into entity ids and keeps their kinds', () => {
    const grid: GameBody = {
      gameType: 'GRID',
      rows: [{ kind: 'CLUB', entity: 'wd:united' }],
      cols: [{ kind: 'NATIONALITY', entity: 'wd:spain' }],
    };
    expect(toEngineBody(grid, idOf, ['en'])).toEqual({
      gameType: 'GRID',
      rows: [{ kind: 'CLUB', entityId: 'id-united' }],
      cols: [{ kind: 'NATIONALITY', entityId: 'id-spain' }],
    });
  });

  it('lists the references a body points at, so they load in one query', () => {
    expect(listEntityReferencesOfBody(career)).toEqual(['wd:ronaldo', 'wd:sporting', 'wd:united']);
    expect(listEntityReferencesOfBody(buzzer)).toEqual([]);
  });
});
