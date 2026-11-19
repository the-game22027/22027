import { randomUUID } from 'node:crypto';
import { computeChecksum } from '../../src/modules/question-bank/application/bundle-parser';

/** Bundle files for question-bank integration tests (07 §5.4). */

// Importing a catalog hides every active entity it does not list, so each test builds its own entities.
export const entitySet = () => {
  const id = randomUUID().slice(0, 8);
  const entity = (name: string, kind: string, arabic: string) => ({
    externalRef: `test:${name}-${id}`,
    kind,
    names: { en: `${name} ${id}`, ar: `${arabic} ${id}` },
    aliases: { en: [`${name}-alias`], ar: [] as string[] },
    popularity: 10,
    search: [`${name.toLowerCase()} ${id}`],
    nameWords: [{ form: `${name.toLowerCase()}${id}`, sharedBy: 1 }],
  });
  return {
    ronaldo: entity('Ronaldo', 'PLAYER', 'رونالدو'),
    nani: entity('Nani', 'PLAYER', 'ناني'),
    sporting: entity('Sporting', 'CLUB', 'سبورتنج'),
    united: entity('United', 'CLUB', 'يونايتد'),
    spain: entity('Spain', 'NATIONAL_TEAM', 'إسبانيا'),
  };
};
export type Entities = ReturnType<typeof entitySet>;

export const common = (key: string, reviewed = { en: true, ar: true }) => ({
  externalKey: key,
  type: 'GAME',
  category: 'players',
  difficulty: 2,
  provenance: { facts: [], sources: ['test'], licenses: ['CC0-1.0'], kbVersion: 'none' },
  validUntil: null,
  humanReviewed: reviewed,
});

export const careerLine = (key: string, e: Entities, extraSpell = false) => ({
  ...common(key),
  gameType: 'CAREER',
  content: {
    player: e.ronaldo.externalRef,
    spells: [
      { club: e.sporting.externalRef, fromYear: 2002, toYear: 2003, loan: false },
      { club: e.united.externalRef, fromYear: 2003, toYear: 2009, loan: false },
      ...(extraSpell ? [{ club: e.united.externalRef, fromYear: 2021, toYear: 2022, loan: false }] : []),
    ],
  },
  answers: [{ slot: 0, entities: [e.ronaldo.externalRef] }],
});

export const buzzerLine = (
  key: string,
  e: Entities,
  steps = ['Which country', 'won the', '2010', 'World Cup?'],
  reviewed = { en: true, ar: false },
) => ({
  ...common(key, reviewed),
  gameType: 'BUZZER',
  content: {
    answerKind: 'NATIONAL_TEAM',
    steps: { en: steps, ar: ['أي منتخب', 'فاز', 'بكأس العالم', '2010؟'] },
  },
  answers: [{ slot: 0, entities: [e.spain.externalRef] }],
});

export const whoLine = (key: string, e: Entities) => ({
  ...common(key),
  gameType: 'WHO_IS_PLAYER',
  content: {
    player: e.ronaldo.externalRef,
    clues: [
      { kind: 'BIRTH_YEAR', text: { en: 'Born in 1985', ar: 'من مواليد 1985' } },
      { kind: 'CLUB_COUNT', text: { en: 'Senior clubs: 6', ar: 'عدد أنديته: 6' } },
      { kind: 'FIRST_CLUB', text: { en: 'Started his senior career at Sporting', ar: 'بدأ مسيرته مع سبورتنج' } },
    ],
  },
  answers: [{ slot: 0, entities: [e.ronaldo.externalRef] }],
});

export const bundle = (bundleVersion: string, lines: object[], catalog?: object[]) => {
  const questionsJsonl = Buffer.from(lines.map((value) => JSON.stringify(value)).join('\n') + '\n');
  const catalogJsonl = catalog
    ? Buffer.from(catalog.map((value) => JSON.stringify(value)).join('\n') + '\n')
    : undefined;
  const manifest = {
    bundleVersion,
    kbVersion: 'none',
    generatorVersion: 'test',
    questionCount: lines.length,
    checksum: computeChecksum(questionsJsonl),
    ...(catalogJsonl ? { catalogChecksum: computeChecksum(catalogJsonl) } : {}),
    categories: [{ slug: 'players', names: { en: 'Players', ar: 'لاعبون' } }],
  };
  return { manifestJson: JSON.stringify(manifest), questionsJsonl, catalogJsonl };
};

/** Three clubs × three countries; every cell has one player, the top-left cell two. */
export const gridFixture = () => {
  const id = randomUUID().slice(0, 8);
  const entity = (name: string, kind: string) => ({
    externalRef: `test:grid-${name}-${id}`,
    kind,
    names: { en: `${name} ${id}`, ar: `${name} ${id}` },
    aliases: { en: [], ar: [] },
    popularity: 1,
    search: [`${name} ${id}`],
  });
  const clubs = ['club-a', 'club-b', 'club-c'].map((name) => entity(name, 'CLUB'));
  const countries = ['land-a', 'land-b', 'land-c'].map((name) => entity(name, 'COUNTRY'));
  const players = Array.from({ length: 10 }, (_, index) => entity(`player-${String(index)}`, 'PLAYER'));
  const line = (key: string) => ({
    ...common(key),
    gameType: 'GRID',
    content: {
      rows: clubs.map((club) => ({ kind: 'CLUB', entity: club.externalRef })),
      cols: countries.map((country) => ({ kind: 'NATIONALITY', entity: country.externalRef })),
    },
    answers: Array.from({ length: 9 }, (_, slot) => ({
      slot,
      entities: slot === 0 ? [players[0], players[9]].map((p) => p?.externalRef) : [players[slot]?.externalRef],
    })),
  });
  return { entities: [...clubs, ...countries, ...players], line, players };
};

/** A MINES category (08 §10.4): one club, one country and eight players who fit both. */
export const minesFixture = () => {
  const id = randomUUID().slice(0, 8);
  const entity = (name: string, kind: string) => ({
    externalRef: `test:mines-${name}-${id}`,
    kind,
    names: { en: `${name} ${id}`, ar: `${name} ${id}` },
    aliases: { en: [], ar: [] },
    popularity: 1,
    search: [`${name} ${id}`],
  });
  const club = entity('club', 'CLUB');
  const country = entity('land', 'COUNTRY');
  const players = Array.from({ length: 8 }, (_, index) => entity(`miner-${String(index)}`, 'PLAYER'));
  const line = (key: string) => ({
    ...common(key),
    gameType: 'MINES',
    content: {
      criteria: [
        { kind: 'CLUB', entity: club.externalRef },
        { kind: 'NATIONALITY', entity: country.externalRef },
      ],
    },
    answers: [{ slot: 0, entities: players.map((player) => player.externalRef) }],
  });
  return { entities: [club, country, ...players], line, players };
};

/** AUCTION lots (08 §11.4): each round offers lists of 4, 5 and 3 players, titled in both languages. */
export const auctionFixture = () => {
  const id = randomUUID().slice(0, 8);
  const sizes = [4, 5, 3];
  const players = sizes.map((size, list) =>
    Array.from({ length: size }, (_, index) => ({
      externalRef: `test:auction-${String(list)}-${String(index)}-${id}`,
      kind: 'PLAYER',
      names: {
        en: `bidder ${String(list)} ${String(index)} ${id}`,
        ar: `bidder ${String(list)} ${String(index)} ${id}`,
      },
      aliases: { en: [], ar: [] },
      popularity: 1,
      search: [`bidder ${String(list)} ${String(index)} ${id}`],
    })),
  );
  const line = (key: string) => ({
    ...common(key),
    gameType: 'AUCTION',
    content: {
      lists: sizes.map((_, list) => ({
        kind: 'SCORERS',
        title: { en: `List ${String(list)} ${id}`, ar: `List ${String(list)} ${id}` },
      })),
    },
    answers: players.map((names, slot) => ({ slot, entities: names.map((player) => player.externalRef) })),
  });
  return { entities: players.flat(), line, players };
};
