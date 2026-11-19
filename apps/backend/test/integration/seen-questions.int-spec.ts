import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { PrismaBattleRepository } from '../../src/modules/battles/infrastructure/prisma-battle.repository';
import { ImportQuestionBundle } from '../../src/modules/question-bank/application/import-question-bundle';
import { QuestionBankCliModule } from '../../src/modules/question-bank/question-bank-cli.module';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { UuidV7Generator } from '../../src/shared/kernel';
import { bundle, buzzerLine, entitySet } from '../support/question-bundles';
import { testConfig } from '../support/test-app';

describe('seen questions for battle content selection (DEC-44)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let battles: PrismaBattleRepository;
  const ids = new UuidV7Generator();
  const e = entitySet();
  const questionIds: string[] = [];
  const minutesAfterNoon = (minutes: number) => new Date(Date.UTC(2026, 10, 19, 12, minutes));

  const createUser = async () => (await prisma.user.create({ data: { id: ids.next() } })).id;

  /** A finished battle of these players; each round is [question index, minute it started or null]. */
  const createBattle = async (userIds: string[], rounds: [number, number | null][], withBot = false) => {
    const createdAt = minutesAfterNoon(0);
    const humans = userIds.map((userId, seat) => ({ id: ids.next(), kind: 'HUMAN' as const, userId, seat }));
    const bot = { id: ids.next(), kind: 'BOT' as const, botProfile: 'test', seat: humans.length };
    await prisma.battle.create({
      data: {
        id: ids.next(),
        status: 'COMPLETED',
        mode: 'MATCHMAKING',
        gameType: 'BUZZER',
        hasBot: withBot,
        config: {},
        createdAt,
        readyDeadlineAt: createdAt,
        participants: { create: [...humans, ...(withBot ? [bot] : [])].map((p) => ({ ...p, locale: 'en' })) },
        rounds: {
          create: rounds.map(([question, minute], index) => ({
            roundNo: index + 1,
            questionId: questionIds[question],
            startedAt: minute === null ? null : minutesAfterNoon(minute),
          })),
        },
      },
    });
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [CoreModule.register(testConfig()), QuestionBankCliModule],
      providers: [PrismaBattleRepository],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    battles = moduleRef.get(PrismaBattleRepository);
    const keys = [1, 2, 3, 4].map(() => `test:${randomUUID()}`);
    await moduleRef.get(ImportQuestionBundle).importBundle(
      bundle(
        `test-${randomUUID()}`,
        keys.map((key) => buzzerLine(key, e)),
        Object.values(e),
      ),
    );
    for (const externalKey of keys) {
      questionIds.push((await prisma.question.findFirstOrThrow({ where: { externalKey } })).id);
    }
  });

  afterAll(() => moduleRef.close());

  it('lists every question a player was shown, most recently seen first, without reserved rounds', async () => {
    const player = await createUser();
    await createBattle(
      [player],
      [
        [0, 1],
        [1, 3],
      ],
      true,
    );
    // Round 2 was reserved but the battle ended before it started (AUCTION, VAULT): not seen.
    await createBattle(
      [player],
      [
        [2, 2],
        [3, null],
      ],
      true,
    );

    await expect(battles.findSeenQuestionIdsMostRecentFirst([player])).resolves.toEqual([
      questionIds[1],
      questionIds[2],
      questionIds[0],
    ]);
  });

  it('merges several players, ranking a question by the last time any of them saw it', async () => {
    const first = await createUser();
    const second = await createUser();
    await createBattle(
      [first],
      [
        [0, 1],
        [1, 2],
      ],
    );
    await createBattle([second], [[2, 3]]);
    await createBattle([first, second], [[0, 4]]);

    await expect(battles.findSeenQuestionIdsMostRecentFirst([first, second])).resolves.toEqual([
      questionIds[0],
      questionIds[2],
      questionIds[1],
    ]);
    await expect(battles.findSeenQuestionIdsMostRecentFirst([second])).resolves.toEqual([
      questionIds[0],
      questionIds[2],
    ]);
  });

  it('returns nothing for a new player or no players', async () => {
    await expect(battles.findSeenQuestionIdsMostRecentFirst([await createUser()])).resolves.toEqual([]);
    await expect(battles.findSeenQuestionIdsMostRecentFirst([])).resolves.toEqual([]);
  });
});
