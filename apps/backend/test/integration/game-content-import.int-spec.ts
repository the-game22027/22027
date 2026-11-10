import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { computeChecksum } from '../../src/modules/question-bank/application/bundle-parser';
import { ImportQuestionBundle } from '../../src/modules/question-bank/application/import-question-bundle';
import { InvalidBundleError } from '../../src/modules/question-bank/domain/question-bank-errors';
import { QuestionBankCliModule } from '../../src/modules/question-bank/question-bank-cli.module';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { testConfig } from '../support/test-app';

// Importing a catalog hides every active entity it does not list, so each test builds its own entities.
const entitySet = () => {
  const id = randomUUID().slice(0, 8);
  const entity = (name: string, kind: string, arabic: string) => ({
    externalRef: `test:${name}-${id}`,
    kind,
    names: { en: `${name} ${id}`, ar: `${arabic} ${id}` },
    aliases: { en: [`${name}-alias`], ar: [] as string[] },
    popularity: 10,
    search: [`${name.toLowerCase()} ${id}`],
  });
  return {
    ronaldo: entity('Ronaldo', 'PLAYER', 'رونالدو'),
    nani: entity('Nani', 'PLAYER', 'ناني'),
    sporting: entity('Sporting', 'CLUB', 'سبورتنج'),
    united: entity('United', 'CLUB', 'يونايتد'),
    spain: entity('Spain', 'NATIONAL_TEAM', 'إسبانيا'),
  };
};
type Entities = ReturnType<typeof entitySet>;

const common = (key: string, reviewed = { en: true, ar: true }) => ({
  externalKey: key,
  type: 'GAME',
  category: 'players',
  difficulty: 2,
  provenance: { facts: [], sources: ['test'], licenses: ['CC0-1.0'], kbVersion: 'none' },
  validUntil: null,
  humanReviewed: reviewed,
});

const careerLine = (key: string, e: Entities, extraSpell = false) => ({
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

const buzzerLine = (key: string, e: Entities, steps = ['Which country', 'won the', '2010', 'World Cup?']) => ({
  ...common(key, { en: true, ar: false }),
  gameType: 'BUZZER',
  content: {
    answerKind: 'NATIONAL_TEAM',
    steps: { en: steps, ar: ['أي منتخب', 'فاز', 'بكأس العالم', '2010؟'] },
  },
  answers: [{ slot: 0, entities: [e.spain.externalRef] }],
});

const bundle = (bundleVersion: string, lines: object[], catalog?: object[]) => {
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

describe('importing a bundle with an answer catalog and game content', () => {
  let moduleRef: TestingModule;
  let importer: ImportQuestionBundle;
  let prisma: PrismaService;
  const newKey = () => `test:${randomUUID()}`;
  const newVersion = () => `test-${randomUUID()}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [CoreModule.register(testConfig()), QuestionBankCliModule],
    }).compile();
    await moduleRef.init();
    importer = moduleRef.get(ImportQuestionBundle);
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(() => moduleRef.close());

  const entityByRef = (externalRef: string) =>
    prisma.answerEntity.findUniqueOrThrow({ where: { externalRef }, include: { aliases: true } });

  it('stores the catalog and game rounds with their accepted answers resolved to entity ids', async () => {
    const e = entitySet();
    const career = newKey();
    const buzzer = newKey();

    const summary = await importer.importBundle(
      bundle(newVersion(), [careerLine(career, e), buzzerLine(buzzer, e)], Object.values(e)),
    );

    expect(summary.catalogSize).toBe(5);
    expect(summary.counts.inserted).toBe(2);
    const ronaldo = await entityByRef(e.ronaldo.externalRef);
    expect(ronaldo).toMatchObject({ kind: 'PLAYER', status: 'ACTIVE', searchForms: e.ronaldo.search });
    expect(ronaldo.aliases.map((alias) => alias.alias)).toEqual(['Ronaldo-alias']);

    const careerRow = await prisma.question.findFirstOrThrow({
      where: { externalKey: career },
      include: { answers: true },
    });
    expect(careerRow).toMatchObject({
      type: 'GAME',
      gameType: 'CAREER',
      answerKind: 'PLAYER',
      status: 'APPROVED',
      availableLocales: ['ar', 'en'],
    });
    expect(careerRow.answers).toEqual([{ questionId: careerRow.id, slot: 0, entityId: ronaldo.id }]);
    expect(careerRow.content).toMatchObject({ gameType: 'CAREER', player: e.ronaldo.externalRef });

    const buzzerRow = await prisma.question.findFirstOrThrow({
      where: { externalKey: buzzer },
      include: { translations: { orderBy: { locale: 'asc' } } },
    });
    expect(buzzerRow).toMatchObject({ gameType: 'BUZZER', answerKind: 'NATIONAL_TEAM', status: 'DRAFT' });
    expect(buzzerRow.translations.map((t) => [t.locale, t.text])).toEqual([
      ['ar', 'أي منتخب فاز بكأس العالم 2010؟'],
      ['en', 'Which country won the 2010 World Cup?'],
    ]);
  });

  it('treats the same bundle with the same catalog as already imported', async () => {
    const e = entitySet();
    const files = bundle(newVersion(), [careerLine(newKey(), e)], Object.values(e));
    await importer.importBundle(files);
    await expect(importer.importBundle(files)).resolves.toMatchObject({ alreadyImported: true });
  });

  it('rejects content that points at an unknown entity or the wrong kind, and keeps the old catalog', async () => {
    const e = entitySet();
    await importer.importBundle(bundle(newVersion(), [careerLine(newKey(), e)], Object.values(e)));
    const wrongKind = careerLine(newKey(), e);
    wrongKind.content.spells[0].club = e.nani.externalRef;
    const unknown = careerLine(newKey(), e);
    unknown.answers = [{ slot: 0, entities: [e.ronaldo.externalRef, 'test:nobody'] }];
    const withoutSpain = Object.values(e).filter((entity) => entity !== e.spain);

    const attempt = importer.importBundle(bundle(newVersion(), [wrongKind, unknown], withoutSpain));

    await expect(attempt).rejects.toThrow(InvalidBundleError);
    await expect(attempt).rejects.toThrow(/spell 1 club .* expected CLUB/);
    await expect(attempt).rejects.toThrow(/test:nobody is not in the answer catalog/);
    // The rejected catalog would have hidden Spain; the transaction rolled that back.
    expect((await entityByRef(e.spain.externalRef)).status).toBe('ACTIVE');
  });

  it('lets a bundle without a catalog use the catalog already imported', async () => {
    const e = entitySet();
    await importer.importBundle(bundle(newVersion(), [careerLine(newKey(), e)], Object.values(e)));
    const summary = await importer.importBundle(bundle(newVersion(), [buzzerLine(newKey(), e)]));
    expect(summary).toMatchObject({ catalogSize: null, counts: { inserted: 1 } });
  });

  it('hides entities a newer catalog drops, keeps their rows, and brings them back when listed again', async () => {
    const e = entitySet();
    await importer.importBundle(bundle(newVersion(), [careerLine(newKey(), e)], Object.values(e)));
    const withoutSpain = Object.values(e).filter((entity) => entity !== e.spain);

    await importer.importBundle(bundle(newVersion(), [careerLine(newKey(), e)], withoutSpain));
    expect((await entityByRef(e.spain.externalRef)).status).toBe('HIDDEN');

    const renamed = {
      ...e.spain,
      names: { en: 'Spain (renamed)', ar: 'إسبانيا' },
      aliases: { en: [], ar: ['لاروخا'] },
    };
    await importer.importBundle(bundle(newVersion(), [careerLine(newKey(), e)], [...withoutSpain, renamed]));
    const spain = await entityByRef(e.spain.externalRef);
    expect(spain).toMatchObject({ status: 'ACTIVE', names: renamed.names });
    expect(spain.aliases.map((alias) => [alias.locale, alias.alias])).toEqual([['ar', 'لاروخا']]);
  });

  it('versions a published career whose content changed, with the answers on the new version', async () => {
    const e = entitySet();
    const key = newKey();
    await importer.importBundle(bundle(newVersion(), [careerLine(key, e)], Object.values(e)));
    await prisma.question.updateMany({
      where: { externalKey: key },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    const summary = await importer.importBundle(bundle(newVersion(), [careerLine(key, e, true)]));

    expect(summary.counts.newVersions).toBe(1);
    const versions = await prisma.question.findMany({
      where: { externalKey: key },
      orderBy: { keyVersion: 'asc' },
      include: { answers: true },
    });
    expect(versions.map((version) => [version.keyVersion, version.status])).toEqual([
      [1, 'DISABLED'],
      [2, 'APPROVED'],
    ]);
    expect(versions[1].answers).toHaveLength(1);
  });

  it('rejects a buzzer question whose text gives the answer away', async () => {
    const e = entitySet();
    const leaky = buzzerLine(newKey(), e, ['Did', e.spain.names.en, 'win', 'in 2010?']);
    await expect(importer.importBundle(bundle(newVersion(), [leaky], Object.values(e)))).rejects.toThrow(
      /gives away the answer/,
    );
  });

  it('refuses a NUMBER kind in the catalog at the database level too', async () => {
    await expect(
      prisma.$executeRaw`INSERT INTO answer_entities (id, external_ref, kind, names, search_forms, catalog_version, updated_at)
        VALUES (${randomUUID()}::uuid, ${`test:n-${randomUUID()}`}, 'NUMBER', '{}', '{}', 'test', now())`,
    ).rejects.toThrow(/answer_entities_kind_is_entity/);
  });
});
