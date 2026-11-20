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

  it('turns the lineup players, shown names and fake into entity ids', () => {
    const lineup: GameBody = {
      gameType: 'LINEUP',
      title: { en: 'Portugal against Spain', ar: 'البرتغال أمام إسبانيا' },
      slots: [{ line: 'FWD', role: 'LW', shirtNumber: 7, captain: true, player: 'wd:ronaldo' }],
      shown: ['wd:sporting', 'wd:ronaldo'],
      fake: 'wd:sporting',
    };
    expect(toEngineBody(lineup, idOf, ['ar'])).toEqual({
      gameType: 'LINEUP',
      title: { ar: 'البرتغال أمام إسبانيا' },
      slots: [{ line: 'FWD', role: 'LW', shirtNumber: 7, captain: true, playerEntityId: 'id-ronaldo' }],
      shownEntityIds: ['id-sporting', 'id-ronaldo'],
      fakeEntityId: 'id-sporting',
    });
    expect(listEntityReferencesOfBody(lineup)).toEqual(['wd:ronaldo', 'wd:sporting']);
  });

  it('turns a ONE_TWO seed into its entity id', () => {
    const seed: GameBody = { gameType: 'ONE_TWO', seed: 'wd:ronaldo' };
    expect(toEngineBody(seed, idOf, ['en'])).toEqual({ gameType: 'ONE_TWO', seedEntityId: 'id-ronaldo' });
    expect(listEntityReferencesOfBody(seed)).toEqual(['wd:ronaldo']);
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

  it('turns a mines category into entity ids and keeps a decade as a year', () => {
    const byNationality: GameBody = {
      gameType: 'MINES',
      criteria: [
        { kind: 'CLUB', entity: 'wd:united' },
        { kind: 'NATIONALITY', entity: 'wd:spain' },
      ],
    };
    const byDecade: GameBody = {
      gameType: 'MINES',
      criteria: [
        { kind: 'CLUB', entity: 'wd:united' },
        { kind: 'DECADE', fromYear: 2000 },
      ],
    };
    expect(toEngineBody(byNationality, idOf, ['en'])).toEqual({
      gameType: 'MINES',
      criteria: [
        { kind: 'CLUB', entityId: 'id-united' },
        { kind: 'NATIONALITY', entityId: 'id-spain' },
      ],
    });
    expect(toEngineBody(byDecade, idOf, ['en'])).toMatchObject({ criteria: [{}, { kind: 'DECADE', fromYear: 2000 }] });
    expect(listEntityReferencesOfBody(byDecade)).toEqual(['wd:united']);
  });

  it('keeps auction titles only in the battle locales and references no entity', () => {
    const auction: GameBody = {
      gameType: 'AUCTION',
      lists: [{ kind: 'SCORERS', title: { en: 'Liverpool scorers', ar: 'هدافو ليفربول' } }],
    };
    expect(toEngineBody(auction, idOf, ['ar'])).toEqual({
      gameType: 'AUCTION',
      lists: [{ kind: 'SCORERS', title: { ar: 'هدافو ليفربول' } }],
    });
    expect(listEntityReferencesOfBody(auction)).toEqual([]);
  });

  it('keeps vault questions with their digits for the engine, in the battle locales only', () => {
    const vault: GameBody = {
      gameType: 'VAULT',
      questions: [{ template: 'TEAM_GOALS', text: { en: 'How many?', ar: 'كم؟' }, answerNumber: 7 }],
    };
    expect(toEngineBody(vault, idOf, ['en'])).toEqual({
      gameType: 'VAULT',
      questions: [{ template: 'TEAM_GOALS', text: { en: 'How many?' }, answerNumber: 7 }],
    });
    expect(listEntityReferencesOfBody(vault)).toEqual([]);
  });

  it('lists the references a body points at, so they load in one query', () => {
    expect(listEntityReferencesOfBody(career)).toEqual(['wd:ronaldo', 'wd:sporting', 'wd:united']);
    expect(listEntityReferencesOfBody(buzzer)).toEqual([]);
  });
});
