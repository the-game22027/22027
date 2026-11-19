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

/** A VAULT round: one question per digit of `code` (08 §12.4). */
export const vaultLine = (key: string, code = '7653') => ({
  ...common(key),
  gameType: 'VAULT',
  content: {
    questions: [...code].map((digit, position) => ({
      template: 'TEAM_GOALS',
      text: { en: `Vault question ${String(position + 1)}?`, ar: `سؤال الخزنة ${String(position + 1)}؟` },
      answerNumber: Number(digit),
    })),
  },
});

/**
 * A LINEUP round: 11 starters in a 4-3-3 (slot 0 the goalkeeper, slot 5 the captain), shown names: starters 1 and 2
 * and the fake, a bench player.
 */
export const lineupFixture = () => {
  const id = randomUUID().slice(0, 8);
  const player = (label: string, name: { en: string; ar: string }) => ({
    externalRef: `test:lineup-${label}-${id}`,
    kind: 'PLAYER',
    names: { en: `${name.en} ${id}`, ar: `${name.ar} ${id}` },
    aliases: { en: [], ar: [] },
    popularity: 1,
    search: [`${name.en} ${id}`, `${name.ar} ${id}`],
  });
  const starters = [
    'Kepa', 'Lopez', 'Moreno', 'Navas', 'Ortiz', 'Pedro', 'Quintero', 'Ramos', 'Silva', 'Torres', 'Urrutia',
  ].map((name, index) => player(`s${String(index)}`, { en: name, ar: `لاعب${String(index)}` })); // prettier-ignore
  const fake = player('fake', { en: 'Benchman', ar: 'البديل' });
  const lines = ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'];
  const line = (key: string) => ({
    ...common(key),
    gameType: 'LINEUP',
    content: {
      title: { en: `Team ${id} against Rivals, final`, ar: `فريق ${id} أمام المنافس، النهائي` },
      slots: starters.map((starter, index) => ({
        line: lines[index],
        role: null,
        shirtNumber: index + 1,
        captain: index === 5,
        player: starter.externalRef,
      })),
      shown: [starters[1]?.externalRef, fake.externalRef, starters[2]?.externalRef],
      fake: fake.externalRef,
    },
    answers: [
      { slot: 0, entities: starters.map((starter) => starter.externalRef) },
      { slot: 1, entities: [fake.externalRef] },
    ],
  });
  return { entities: [...starters, fake], starters, fake, line };
};

/** A 3×3 HEX board, every cell م / m, one question per cell: two right names and one with another letter. */
export const hexFixture = () => {
  const id = randomUUID().slice(0, 8);
  const player = (cell: number, name: { en: string; ar: string }) => ({
    externalRef: `test:hex-${String(cell)}-${name.en.split(' ')[0] ?? ''}-${id}`,
    kind: 'PLAYER',
    names: name,
    aliases: { en: [], ar: [] },
    popularity: 1,
    search: [name.en, name.ar],
  });
  const lists = Array.from({ length: 9 }, (_, cell) => [
    player(cell, { en: `Mido ${String(cell)} ${id}`, ar: `ميدو ${String(cell)} ${id}` }),
    player(cell, { en: `Miro ${String(cell)} ${id}`, ar: `ميرو ${String(cell)} ${id}` }),
    player(cell, { en: `Zico ${String(cell)} ${id}`, ar: `زيكو ${String(cell)} ${id}` }),
  ]);
  const line = (key: string) => ({
    ...common(key),
    gameType: 'HEX',
    content: {
      size: 3,
      cells: lists.map((_, cell) => ({
        letter: { en: 'M', ar: 'م' },
        questions: [
          { kind: 'SCORERS', title: { en: `List ${String(cell)} ${id}`, ar: `قائمة ${String(cell)} ${id}` } },
        ],
      })),
    },
    answers: lists.map((names, slot) => ({ slot, entities: names.map((entry) => entry.externalRef) })),
  });
  return { entities: lists.flat(), line, lists };
};
