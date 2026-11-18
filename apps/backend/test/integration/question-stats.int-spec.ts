import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { RecordQuestionStats } from '../../src/modules/question-bank/application/record-question-stats';
import { ImportQuestionBundle } from '../../src/modules/question-bank/application/import-question-bundle';
import { QuestionReports } from '../../src/modules/question-bank/application/question-reports';
import { QuestionBankCliModule } from '../../src/modules/question-bank/question-bank-cli.module';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { UuidV7Generator } from '../../src/shared/kernel';
import { WorkerModule } from '../../src/worker.module';
import { bundle, buzzerLine, entitySet } from '../support/question-bundles';
import { testConfig } from '../support/test-app';

const ids = new UuidV7Generator();

describe('question stats in the worker', () => {
  let worker: TestingModule;
  let prisma: PrismaService;
  const questionIds: string[] = [];

  beforeAll(async () => {
    // Imported first and closed: two Nest apps in one process share @nestjs-cls state (learn/testing).
    const importer = await Test.createTestingModule({
      imports: [CoreModule.register(testConfig()), QuestionBankCliModule],
    }).compile();
    await importer.init();
    const e = entitySet();
    const keys = [`test:${randomUUID()}`, `test:${randomUUID()}`];
    await importer.get(ImportQuestionBundle).importBundle(
      bundle(
        `stats-${randomUUID()}`,
        keys.map((key) => buzzerLine(key, e)),
        Object.values(e),
      ),
    );
    for (const externalKey of keys) {
      questionIds.push((await importer.get(PrismaService).question.findFirstOrThrow({ where: { externalKey } })).id);
    }
    await importer.close();

    worker = await Test.createTestingModule({ imports: [WorkerModule.register(testConfig())] }).compile();
    await worker.init();
    prisma = worker.get(PrismaService);
  });

  afterAll(() => worker.close());

  it('adds served rounds once per battle, even when the event comes twice', async () => {
    const [solvedQuestion, missedQuestion] = questionIds;
    const battleId = ids.next();
    const questionResults = [
      {
        roundNo: 1,
        questionId: solvedQuestion,
        endReason: 'CORRECT',
        served: true,
        solved: true,
        wrongAnswers: 1,
        stepsRevealed: 3,
      },
      {
        roundNo: 2,
        questionId: missedQuestion,
        endReason: 'NO_WINNER',
        served: true,
        solved: false,
        wrongAnswers: 2,
        stepsRevealed: 6,
      },
    ];
    await prisma.outboxEvent.create({
      data: {
        id: ids.next(),
        type: 'BattleCompleted',
        version: 1,
        aggregateType: 'battle',
        aggregateId: battleId,
        occurredAt: new Date(),
        payload: {
          battleId,
          mode: 'MATCHMAKING',
          gameType: 'BUZZER',
          hasBot: true,
          roomId: null,
          endedAt: new Date().toISOString(),
          ruleSetId: null,
          participants: [],
          questionResults,
        },
      },
    });

    const statsOf = (questionId: string | undefined) => prisma.questionStats.findUnique({ where: { questionId } });
    let solved = await statsOf(solvedQuestion);
    for (let waited = 0; !solved && waited < 20_000; waited += 200) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      solved = await statsOf(solvedQuestion);
    }

    expect(solved).toMatchObject({ timesServed: 1, timesSolved: 1, wrongAnswers: 1, stepsToSolveSum: 3 });
    expect(await statsOf(missedQuestion)).toMatchObject({
      timesServed: 1,
      timesSolved: 0,
      wrongAnswers: 2,
      stepsToSolveSum: 0,
    });

    const appliedAgain = await worker.get(RecordQuestionStats).recordQuestionStatsOfBattle(battleId, questionResults);
    expect(appliedAgain).toBe(false);
    expect(await statsOf(solvedQuestion)).toMatchObject({ timesServed: 1, timesSolved: 1 });

    await worker.get(RecordQuestionStats).recordQuestionStatsOfBattle(ids.next(), questionResults);
    expect(await statsOf(solvedQuestion)).toMatchObject({ timesServed: 2, timesSolved: 2, stepsToSolveSum: 6 });
  }, 30_000);
});

describe('question reports listing', () => {
  it('lists the most reported questions first, with their latest reasons', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CoreModule.register(testConfig()), QuestionBankCliModule],
    }).compile();
    await moduleRef.init();
    const prisma = moduleRef.get(PrismaService);
    const reports = moduleRef.get(QuestionReports);
    const e = entitySet();
    const keys = [`test:${randomUUID()}`, `test:${randomUUID()}`];
    await moduleRef.get(ImportQuestionBundle).importBundle(
      bundle(
        `reports-${randomUUID()}`,
        keys.map((key) => buzzerLine(key, e)),
        Object.values(e),
      ),
    );
    const [often, once] = await Promise.all(
      keys.map(async (externalKey) => (await prisma.question.findFirstOrThrow({ where: { externalKey } })).id),
    );
    const players = await Promise.all(
      [1, 2, 3, 4].map(async () => (await prisma.user.create({ data: { id: ids.next() } })).id),
    );
    for (const [index, player] of players.entries()) {
      await reports.reportQuestion(often ?? '', player, `reason ${String(index + 1)}`);
    }
    await reports.reportQuestion(once ?? '', players[0] ?? '', 'only one');

    const listed = await reports.listMostReportedQuestions(1000);
    const mine = listed.filter((question) => question.questionId === often || question.questionId === once);
    expect(mine).toEqual([
      expect.objectContaining({
        questionId: often,
        reportCount: 4,
        latestReasons: ['reason 4', 'reason 3', 'reason 2'],
      }),
      expect.objectContaining({ questionId: once, reportCount: 1, latestReasons: ['only one'], status: 'DRAFT' }),
    ]);
    await moduleRef.close();
  });
});
