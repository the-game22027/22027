import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { computeChecksum } from '../../src/modules/question-bank/application/bundle-parser';
import { ImportQuestionBundle } from '../../src/modules/question-bank/application/import-question-bundle';
import {
  BundleVersionReusedError,
  InvalidBundleError,
} from '../../src/modules/question-bank/domain/question-bank-errors';
import { QuestionBankCliModule } from '../../src/modules/question-bank/question-bank-cli.module';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { testConfig } from '../support/test-app';

interface LineOptions {
  key: string;
  winner?: string;
  reviewed?: { en?: boolean; ar?: boolean };
}

const line = ({ key, winner = 'Spain', reviewed = { en: true, ar: true } }: LineOptions) => ({
  externalKey: key,
  type: 'SINGLE_CHOICE',
  category: 'world-cup',
  difficulty: 2,
  locales: {
    en: { text: 'Which country won the 2010 World Cup?', explanation: null },
    ar: { text: 'أي منتخب فاز بكأس العالم 2010؟', explanation: null },
  },
  options: [
    { position: 1, isCorrect: true, entityRef: null, locales: { en: winner, ar: 'إسبانيا' } },
    { position: 2, isCorrect: false, entityRef: null, locales: { en: 'Netherlands', ar: 'هولندا' } },
  ],
  provenance: { facts: [], sources: ['hand-written'], licenses: ['CC0-1.0'], kbVersion: 'none' },
  validUntil: null,
  humanReviewed: reviewed,
});

const bundle = (bundleVersion: string, lines: object[]) => {
  const questionsJsonl = Buffer.from(lines.map((value) => JSON.stringify(value)).join('\n') + '\n');
  const manifest = {
    bundleVersion,
    kbVersion: 'none',
    generatorVersion: 'test',
    questionCount: lines.length,
    checksum: computeChecksum(questionsJsonl),
    categories: [{ slug: 'world-cup', names: { en: 'World Cup', ar: 'كأس العالم' } }],
  };
  return { manifestJson: JSON.stringify(manifest), questionsJsonl };
};

describe('importing a question bundle', () => {
  let moduleRef: TestingModule;
  let importer: ImportQuestionBundle;
  let prisma: PrismaService;

  const newKey = () => `test:${randomUUID()}`;
  const newVersion = () => `test-${randomUUID()}`;
  const versionsOf = (externalKey: string) =>
    prisma.question.findMany({
      where: { externalKey },
      orderBy: { keyVersion: 'asc' },
      include: { options: { include: { translations: true } }, translations: true },
    });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [CoreModule.register(testConfig()), QuestionBankCliModule],
    }).compile();
    await moduleRef.init();
    importer = moduleRef.get(ImportQuestionBundle);
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(() => moduleRef.close());

  it('stores new questions, APPROVED only when every locale was reviewed', async () => {
    const reviewed = newKey();
    const draft = newKey();
    const version = newVersion();

    const summary = await importer.importBundle(
      bundle(version, [line({ key: reviewed }), line({ key: draft, reviewed: { en: true } })]),
    );

    expect(summary).toEqual({
      bundleVersion: version,
      alreadyImported: false,
      catalogSize: null,
      counts: { inserted: 2, unchanged: 0, reviewsRecorded: 0, contentReplaced: 0, newVersions: 0 },
    });
    const [stored] = await versionsOf(reviewed);
    expect(stored).toMatchObject({ status: 'APPROVED', keyVersion: 1, availableLocales: ['ar', 'en'] });
    expect(stored?.licenseFlags).toEqual(['CC0-1.0']);
    expect(stored?.options.map((option) => option.isCorrect)).toEqual([true, false]);
    expect(stored?.options[0]?.translations).toHaveLength(2);
    expect((await versionsOf(draft))[0]?.status).toBe('DRAFT');
    const batch = await prisma.questionImportBatch.findUniqueOrThrow({ where: { bundleVersion: version } });
    expect(batch.stats).toMatchObject({ inserted: 2 });
  });

  it('does nothing when the same bundle is imported again', async () => {
    const files = bundle(newVersion(), [line({ key: newKey() })]);
    await importer.importBundle(files);
    const before = await prisma.question.count();

    await expect(importer.importBundle(files)).resolves.toMatchObject({ alreadyImported: true });
    expect(await prisma.question.count()).toBe(before);
  });

  it('refuses a bundle version that was already used for other content', async () => {
    const version = newVersion();
    await importer.importBundle(bundle(version, [line({ key: newKey() })]));
    const key = newKey();

    await expect(importer.importBundle(bundle(version, [line({ key })]))).rejects.toThrow(BundleVersionReusedError);
    expect(await versionsOf(key)).toHaveLength(0);
  });

  it('imports nothing when one line is invalid', async () => {
    const valid = newKey();
    const version = newVersion();
    const broken = { ...line({ key: newKey() }), difficulty: 9 };

    await expect(importer.importBundle(bundle(version, [line({ key: valid }), broken]))).rejects.toThrow(
      /line 2: difficulty must be an integer from 1 to 5/,
    );
    expect(await versionsOf(valid)).toHaveLength(0);
    expect(await prisma.questionImportBatch.count({ where: { bundleVersion: version } })).toBe(0);
  });

  it('refuses a bundle whose questions file does not match the checksum', async () => {
    const files = bundle(newVersion(), [line({ key: newKey() })]);
    const tampered = {
      ...files,
      questionsJsonl: Buffer.from(files.questionsJsonl.toString().replace('Spain', 'Italy')),
    };

    await expect(importer.importBundle(tampered)).rejects.toThrow(InvalidBundleError);
  });

  it('keeps an unchanged question as it is in a later bundle, which it now belongs to', async () => {
    const key = newKey();
    await importer.importBundle(bundle(newVersion(), [line({ key })]));
    const [before] = await versionsOf(key);

    const summary = await importer.importBundle(bundle(newVersion(), [line({ key })]));

    expect(summary.counts.unchanged).toBe(1);
    const [after] = await versionsOf(key);
    expect(after).toMatchObject({ id: before?.id, contentHash: before?.contentHash, keyVersion: before?.keyVersion });
    // Publishing the later bundle must cover it (07 §5.5).
    expect(after?.importBatchId).not.toBe(before?.importBatchId);
  });

  it('records a new review and approves the draft without touching its content', async () => {
    const key = newKey();
    await importer.importBundle(bundle(newVersion(), [line({ key, reviewed: { en: true } })]));
    const [before] = await versionsOf(key);

    const summary = await importer.importBundle(bundle(newVersion(), [line({ key })]));

    expect(summary.counts.reviewsRecorded).toBe(1);
    const [after] = await versionsOf(key);
    expect(after).toMatchObject({ id: before?.id, status: 'APPROVED', contentHash: before?.contentHash });
    expect(after?.translations.every((translation) => translation.humanReviewed)).toBe(true);
  });

  it('replaces the content of a question that was never published', async () => {
    const key = newKey();
    await importer.importBundle(bundle(newVersion(), [line({ key })]));
    const [before] = await versionsOf(key);

    const summary = await importer.importBundle(bundle(newVersion(), [line({ key, winner: 'España' })]));

    expect(summary.counts.contentReplaced).toBe(1);
    const versions = await versionsOf(key);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.id).toBe(before?.id);
    expect(versions[0]?.contentHash).not.toBe(before?.contentHash);
    const correct = versions[0]?.options.find((option) => option.isCorrect);
    expect(correct?.translations.find((translation) => translation.locale === 'en')?.text).toBe('España');
  });

  it('adds a new version and disables the old one when a published question changes', async () => {
    const key = newKey();
    await importer.importBundle(bundle(newVersion(), [line({ key })]));
    const [published] = await versionsOf(key);
    await prisma.question.update({
      where: { id: published?.id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    const summary = await importer.importBundle(bundle(newVersion(), [line({ key, winner: 'España' })]));

    expect(summary.counts.newVersions).toBe(1);
    const [old, current] = await versionsOf(key);
    expect(old).toMatchObject({ id: published?.id, status: 'DISABLED', disabledReason: 'SUPERSEDED' });
    expect(old?.contentHash).toBe(published?.contentHash);
    expect(current).toMatchObject({ keyVersion: 2, status: 'APPROVED' });
  });

  it('lets the database refuse a second correct option', async () => {
    const key = newKey();
    await importer.importBundle(bundle(newVersion(), [line({ key })]));
    const [stored] = await versionsOf(key);
    const wrong = stored?.options.find((option) => !option.isCorrect);

    await expect(
      prisma.questionOption.update({ where: { id: wrong?.id }, data: { isCorrect: true } }),
    ).rejects.toThrow();
  });
});
