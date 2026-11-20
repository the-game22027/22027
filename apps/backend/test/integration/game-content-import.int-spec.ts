import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { ImportQuestionBundle } from '../../src/modules/question-bank/application/import-question-bundle';
import {
  BundleVersionReusedError,
  InvalidBundleError,
} from '../../src/modules/question-bank/domain/question-bank-errors';
import { QuestionBankCliModule } from '../../src/modules/question-bank/question-bank-cli.module';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { buzzerLine, bundle, careerLine, entitySet, oneTwoFixture } from '../support/question-bundles';
import { testConfig } from '../support/test-app';

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
    expect(ronaldo).toMatchObject({
      kind: 'PLAYER',
      status: 'ACTIVE',
      searchForms: e.ronaldo.search,
      nameWords: e.ronaldo.nameWords,
    });
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

  it('stores a ONE_TWO graph as pass-type readings with counts, and replaces it as a whole', async () => {
    const graph = oneTwoFixture();
    const summary = await importer.importBundle(
      bundle(newVersion(), [graph.line(newKey())], [...Object.values(entitySet()), ...graph.entities], graph),
    );
    expect(summary.linkCount).toBe(graph.links.length);
    const seed = await entityByRef(graph.seed.externalRef);
    const club = await entityByRef(graph.club.externalRef);
    const counts = await prisma.entityLinkCount.findMany({ where: { entityId: { in: [seed.id, club.id] } } });
    expect(
      Object.fromEntries(
        counts.map((row) => [`${row.entityId === seed.id ? 'seed' : 'club'}:${row.passType}`, row.neighbourCount]),
      ),
    ).toEqual({
      'seed:FACED_IN_FINAL': 3,
      'seed:SCORED_IN_SAME_MATCH': 3,
      'seed:FACED_IN_KNOCKOUT': 4,
      'seed:SCORED_AGAINST': 1,
      'seed:ASSIST_RECEIVED': 1,
      'club:CONCEDED_TO': 4,
    });
    const assist = await prisma.entityLink.findFirstOrThrow({
      where: { toEntityId: seed.id, passType: 'ASSIST_GIVEN' },
      include: { match: true },
    });
    expect(assist.match.evidence).toEqual(graph.matches[0].evidence);

    // A newer graph replaces the old one: nothing of the first graph is left.
    const next = oneTwoFixture();
    await importer.importBundle(
      bundle(newVersion(), [next.line(newKey())], [...graph.entities, ...next.entities], next),
    );
    expect(await prisma.entityLink.count({ where: { fromEntityId: seed.id } })).toBe(0);
    expect(await prisma.entityLinkCount.count({ where: { entityId: seed.id } })).toBe(0);
    expect(await prisma.linkMatch.count({ where: { externalKey: graph.matches[0].key } })).toBe(0);
  });

  it('rejects a graph that points outside the catalog or at the wrong kind, and keeps the old graph', async () => {
    const graph = oneTwoFixture();
    await importer.importBundle(bundle(newVersion(), [graph.line(newKey())], graph.entities, graph));
    const broken = oneTwoFixture();
    const links = [...broken.links, { ...broken.links[0], to: broken.club.externalRef }];
    const attempt = importer.importBundle(
      bundle(
        newVersion(),
        [broken.line(newKey())],
        broken.entities.filter((e) => e !== broken.fourth),
        {
          links,
          matches: broken.matches,
        },
      ),
    );
    await expect(attempt).rejects.toThrow(InvalidBundleError);
    await expect(attempt).rejects.toThrow(/is not in the answer catalog/);
    await expect(attempt).rejects.toThrow(/is a CLUB, expected PLAYER/);
    const seed = await entityByRef(graph.seed.externalRef);
    expect(await prisma.entityLinkCount.count({ where: { entityId: seed.id } })).toBe(5);
  });

  it('refuses the same version with a rebuilt graph instead of skipping it as already imported', async () => {
    const graph = oneTwoFixture();
    const version = newVersion();
    const lines = [graph.line(newKey())];
    await importer.importBundle(bundle(version, lines, graph.entities, graph));
    const rebuilt = { links: graph.links.slice(1), matches: graph.matches };
    await expect(importer.importBundle(bundle(version, lines, graph.entities, rebuilt))).rejects.toThrow(
      BundleVersionReusedError,
    );
    await expect(importer.importBundle(bundle(version, lines, graph.entities, graph))).resolves.toMatchObject({
      alreadyImported: true,
    });
  });

  it('drops the links of names a newer catalog without a graph no longer lists', async () => {
    const graph = oneTwoFixture();
    await importer.importBundle(bundle(newVersion(), [graph.line(newKey())], graph.entities, graph));
    const withoutFirst = graph.entities.filter((entity) => entity !== graph.first);
    await importer.importBundle(bundle(newVersion(), [graph.line(newKey())], withoutFirst));

    const first = await entityByRef(graph.first.externalRef);
    const seed = await entityByRef(graph.seed.externalRef);
    expect(first.status).toBe('HIDDEN');
    expect(
      await prisma.entityLink.count({ where: { OR: [{ fromEntityId: first.id }, { toEntityId: first.id }] } }),
    ).toBe(0);
    const finals = await prisma.entityLinkCount.findUniqueOrThrow({
      where: { entityId_passType: { entityId: seed.id, passType: 'FACED_IN_FINAL' } },
    });
    expect(finals.neighbourCount).toBe(2);
  });
});
