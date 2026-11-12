import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AnswerCatalogQuery } from '../../src/modules/question-bank/application/answer-catalog.query';
import { AnswerChecker } from '../../src/modules/question-bank/application/answer-checker';
import { ContentSelector } from '../../src/modules/question-bank/application/content-selector';
import { ImportQuestionBundle } from '../../src/modules/question-bank/application/import-question-bundle';
import type { ContentSelectionCriteria } from '../../src/modules/question-bank/application/ports/question-read-repository';
import { QuestionBankFacade } from '../../src/modules/question-bank/application/question-bank.facade';
import { RoundContentQuery } from '../../src/modules/question-bank/application/round-content.query';
import {
  BundleNotImportedError,
  InvalidDisableReasonError,
  QuestionNotFoundError,
} from '../../src/modules/question-bank/domain/question-bank-errors';
import { QuestionBankModule } from '../../src/modules/question-bank/question-bank.module';
import { QuestionBankCliModule } from '../../src/modules/question-bank/question-bank-cli.module';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { UuidV7Generator } from '../../src/shared/kernel';
import { bundle, buzzerLine, careerLine, entitySet, gridFixture } from '../support/question-bundles';
import { testConfig } from '../support/test-app';

const newKey = () => `test:${randomUUID()}`;

describe('serving content to battles', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let selector: ContentSelector;
  let rounds: RoundContentQuery;
  let checker: AnswerChecker;
  let catalog: AnswerCatalogQuery;
  let questionBank: QuestionBankFacade;
  const ids = new UuidV7Generator();

  const e = entitySet();
  const grid = gridFixture();
  const keys = {
    career: newKey(),
    hardCareer: newKey(),
    expiredCareer: newKey(),
    buzzer: newKey(),
    draftBuzzer: newKey(),
    grid: newKey(),
  };
  const bundleVersion = `test-${randomUUID()}`;
  // One letter away from Ronaldo's name: typing it exactly must not pass as a typo of Ronaldo (08 §5.3).
  const ronaldoTwin = {
    ...e.nani,
    externalRef: `${e.ronaldo.externalRef}-twin`,
    search: [e.ronaldo.search[0].replace('ronaldo', 'ronaldx')],
  };
  const catalogEntities = [...Object.values(e), ronaldoTwin, ...grid.entities];
  const files = bundle(
    bundleVersion,
    [
      careerLine(keys.career, e),
      { ...careerLine(keys.hardCareer, e, true), difficulty: 4 },
      { ...careerLine(keys.expiredCareer, e), validUntil: '2020-01-01T00:00:00.000Z' },
      buzzerLine(keys.buzzer, e, undefined, { en: true, ar: true }),
      buzzerLine(keys.draftBuzzer, e, ['Who', 'won', 'in', '2010?']),
      grid.line(keys.grid),
    ],
    catalogEntities,
  );
  const contentId: Record<keyof typeof keys, string> = {} as Record<keyof typeof keys, string>;
  const entityId = (externalRef: string) =>
    prisma.answerEntity.findUniqueOrThrow({ where: { externalRef } }).then((row) => row.id);
  const pickAll = (criteria: Partial<ContentSelectionCriteria> & Pick<ContentSelectionCriteria, 'gameType'>) =>
    selector.pickContentIds({ count: 1000, locales: ['ar', 'en'], excludeContentIds: [], ...criteria });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [CoreModule.register(testConfig()), QuestionBankCliModule, QuestionBankModule],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    selector = moduleRef.get(ContentSelector);
    rounds = moduleRef.get(RoundContentQuery);
    checker = moduleRef.get(AnswerChecker);
    catalog = moduleRef.get(AnswerCatalogQuery);
    questionBank = moduleRef.get(QuestionBankFacade);

    await moduleRef.get(ImportQuestionBundle).importBundle(files);
    for (const [name, externalKey] of Object.entries(keys) as [keyof typeof keys, string][]) {
      contentId[name] = (await prisma.question.findFirstOrThrow({ where: { externalKey } })).id;
    }
  });

  afterAll(() => moduleRef.close());

  describe('publishing', () => {
    it('publishes the approved questions of a bundle once, and counts the drafts', async () => {
      const batch = await prisma.questionImportBatch.findUniqueOrThrow({ where: { bundleVersion } });

      await expect(questionBank.publishQuestionsOfBundle(bundleVersion)).resolves.toEqual({
        publishedCount: 5,
        waitingForReviewCount: 1,
      });
      await expect(questionBank.publishQuestionsOfBundle(bundleVersion)).resolves.toEqual({
        publishedCount: 0,
        waitingForReviewCount: 1,
      });

      const career = await prisma.question.findUniqueOrThrow({ where: { id: contentId.career } });
      expect(career).toMatchObject({ status: 'PUBLISHED', publishedAt: expect.any(Date) as Date });
      const events = await prisma.outboxEvent.findMany({ where: { aggregateId: batch.id } });
      expect(events.map((event) => [event.type, event.payload])).toEqual([
        ['QuestionsPublished', { batchId: batch.id, publishedCount: 5 }],
      ]);
    });

    it('publishes drafts too when asked, for development bundles', async () => {
      const version = `test-${randomUUID()}`;
      const draftKey = newKey();
      // No catalog: the bundle uses the one already imported, so the catalog version stays the same.
      await moduleRef
        .get(ImportQuestionBundle)
        .importBundle(bundle(version, [buzzerLine(draftKey, e), careerLine(newKey(), e)]));

      await expect(questionBank.publishQuestionsOfBundle(version, { includeDrafts: true })).resolves.toEqual({
        publishedCount: 2,
        waitingForReviewCount: 0,
      });
      await expect(prisma.question.findFirstOrThrow({ where: { externalKey: draftKey } })).resolves.toMatchObject({
        status: 'PUBLISHED',
      });
    });

    it('publishes a later bundle completely, including rounds it carried over unchanged', async () => {
      const first = `test-${randomUUID()}`;
      const second = `test-${randomUUID()}`;
      const carried = careerLine(newKey(), e);
      const fresh = careerLine(newKey(), e);
      const importer = moduleRef.get(ImportQuestionBundle);
      await importer.importBundle(bundle(first, [carried]));
      await importer.importBundle(bundle(second, [carried, fresh]));

      await expect(questionBank.publishQuestionsOfBundle(second)).resolves.toMatchObject({ publishedCount: 2 });
      const statuses = await prisma.question.findMany({
        where: { externalKey: { in: [carried.externalKey, fresh.externalKey] } },
        select: { status: true },
      });
      expect(statuses.map((row) => row.status)).toEqual(['PUBLISHED', 'PUBLISHED']);
    });

    it('refuses a bundle that was never imported', async () => {
      await expect(questionBank.publishQuestionsOfBundle('never-imported')).rejects.toBeInstanceOf(
        BundleNotImportedError,
      );
    });
  });

  describe('selection', () => {
    it('picks published, unexpired content of the game type only', async () => {
      const careers = await pickAll({ gameType: 'CAREER' });
      expect(careers).toEqual(expect.arrayContaining([contentId.career, contentId.hardCareer]));
      expect(careers).not.toContain(contentId.expiredCareer);
      expect(careers).not.toContain(contentId.buzzer);

      const buzzers = await pickAll({ gameType: 'BUZZER' });
      expect(buzzers).toContain(contentId.buzzer);
      expect(buzzers).not.toContain(contentId.draftBuzzer);
    });

    it('filters by difficulty, exclusion list and count', async () => {
      const hard = await pickAll({ gameType: 'CAREER', difficulties: [4] });
      expect(hard).toContain(contentId.hardCareer);
      expect(hard).not.toContain(contentId.career);

      const rest = await pickAll({ gameType: 'CAREER', excludeContentIds: [contentId.career] });
      expect(rest).toContain(contentId.hardCareer);
      expect(rest).not.toContain(contentId.career);

      await expect(pickAll({ gameType: 'CAREER', count: 1 })).resolves.toHaveLength(1);
    });

    it('skips a grid whose emptiest cell has fewer answers than the game wants', async () => {
      await expect(pickAll({ gameType: 'GRID', minAnswersPerSlot: 1 })).resolves.toContain(contentId.grid);
      await expect(pickAll({ gameType: 'GRID', minAnswersPerSlot: 2 })).resolves.not.toContain(contentId.grid);
    });
  });

  describe('engine content and typed answers', () => {
    it('gives the engine entity ids and the accepted answers per slot', async () => {
      const content = await rounds.getContentForEngine(contentId.career, ['en']);
      const ronaldo = await entityId(e.ronaldo.externalRef);

      expect(content).toEqual({
        contentId: contentId.career,
        gameType: 'CAREER',
        answerKind: 'PLAYER',
        difficulty: 2,
        body: {
          gameType: 'CAREER',
          playerEntityId: ronaldo,
          spells: [
            { clubEntityId: await entityId(e.sporting.externalRef), fromYear: 2002, toYear: 2003, loan: false },
            { clubEntityId: await entityId(e.united.externalRef), fromYear: 2003, toYear: 2009, loan: false },
          ],
        },
        acceptedAnswers: [{ slot: 0, entityIds: [ronaldo] }],
      });

      const gridContent = await rounds.getContentForEngine(contentId.grid, ['ar']);
      expect(gridContent.acceptedAnswers.map((answer) => [answer.slot, answer.entityIds.length])).toEqual([
        [0, 2],
        [1, 1],
        [2, 1],
        [3, 1],
        [4, 1],
        [5, 1],
        [6, 1],
        [7, 1],
        [8, 1],
      ]);
    });
  });

  describe('typed text answers (ADR-0021)', () => {
    const rules = {
      maxLength: 40,
      typoTolerance: [
        { fromLetters: 0, edits: 0 },
        { fromLetters: 4, edits: 1 },
        { fromLetters: 8, edits: 2 },
      ],
      singleWordMaxSharedBy: 2,
    };
    const judge = (text: string, slot = 0) => checker.judgeTypedText(contentId.career, slot, text, rules);

    it('accepts a full name, a distinctive single word and a typo', async () => {
      const ronaldo = await entityId(e.ronaldo.externalRef);
      await expect(judge(e.ronaldo.search[0].toUpperCase())).resolves.toEqual({
        verdict: 'CORRECT',
        entityId: ronaldo,
        match: 'EXACT',
      });
      await expect(judge(e.ronaldo.nameWords[0].form)).resolves.toMatchObject({ verdict: 'CORRECT', match: 'EXACT' });
      await expect(judge(e.ronaldo.search[0].replace('ronaldo', 'ronldo'))).resolves.toEqual({
        verdict: 'CORRECT',
        entityId: ronaldo,
        match: 'TYPO',
      });
    });

    it("calls another entity's exact name wrong, even one typo from the answer", async () => {
      await expect(judge(ronaldoTwin.search[0])).resolves.toEqual({
        verdict: 'WRONG',
        entityId: await entityId(ronaldoTwin.externalRef),
        match: 'OTHER_ENTITY',
      });
      await expect(judge(e.nani.search[0])).resolves.toMatchObject({ verdict: 'WRONG', match: 'OTHER_ENTITY' });
      // Slot 1 of a career round accepts nobody, so Ronaldo is just another player there.
      await expect(judge(e.ronaldo.search[0], 1)).resolves.toMatchObject({ verdict: 'WRONG', match: 'OTHER_ENTITY' });
    });

    it('shows nothing for text that names nobody, or an entity of another kind', async () => {
      const nothing = { verdict: 'WRONG', entityId: null, match: 'NONE' };
      await expect(judge('somebody else entirely')).resolves.toEqual(nothing);
      await expect(judge(e.sporting.search[0])).resolves.toEqual(nothing);
    });

    it('refuses blank and too long text, and unknown content', async () => {
      await expect(judge('  ')).resolves.toEqual({ verdict: 'EMPTY' });
      await expect(judge('x'.repeat(41))).resolves.toEqual({ verdict: 'EMPTY' });
      await expect(checker.judgeTypedText(ids.next(), 0, 'ronaldo', rules)).rejects.toBeInstanceOf(
        QuestionNotFoundError,
      );
    });
  });

  describe('disabling', () => {
    it('stops selection at once, writes one event, and keeps the content readable for running battles', async () => {
      const id = contentId.hardCareer;

      await expect(questionBank.disableQuestion(id, '  wrong year  ')).resolves.toBe(true);
      await expect(questionBank.disableQuestion(id, 'again')).resolves.toBe(false);

      await expect(prisma.question.findUniqueOrThrow({ where: { id } })).resolves.toMatchObject({
        status: 'DISABLED',
        disabledReason: 'wrong year',
      });
      await expect(pickAll({ gameType: 'CAREER' })).resolves.not.toContain(id);
      await expect(rounds.getContentForEngine(id, ['en'])).resolves.toMatchObject({ contentId: id });
      const events = await prisma.outboxEvent.findMany({ where: { aggregateId: id } });
      expect(events.map((event) => [event.type, event.payload])).toEqual([
        ['QuestionDisabled', { questionId: id, reason: 'wrong year' }],
      ]);
    });

    it('refuses an unknown question and an empty reason', async () => {
      await expect(questionBank.disableQuestion(ids.next(), 'reason')).rejects.toBeInstanceOf(QuestionNotFoundError);
      await expect(questionBank.disableQuestion(contentId.career, '   ')).rejects.toBeInstanceOf(
        InvalidDisableReasonError,
      );
    });
  });

  describe('answer catalog', () => {
    it('finds entity names by id for battle events', async () => {
      const id = await entityId(e.spain.externalRef);
      await expect(catalog.findEntitiesByIds([id])).resolves.toEqual([
        expect.objectContaining({ id, kind: 'NATIONAL_TEAM', names: e.spain.names }),
      ]);
      await expect(catalog.findEntitiesByIds([])).resolves.toEqual([]);
    });

    it('offers popular wrong answers of the same kind, never an accepted one', async () => {
      const spain = await entityId(e.spain.externalRef);
      const decoys = await catalog.findDecoyEntityIds('PLAYER', [await entityId(e.ronaldo.externalRef)], 50);
      expect(decoys).toContain(await entityId(e.nani.externalRef));
      expect(decoys).not.toContain(await entityId(e.ronaldo.externalRef));
      expect(decoys).not.toContain(spain);
    });
  });
});
