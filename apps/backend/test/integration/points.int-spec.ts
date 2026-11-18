import { Test, type TestingModule } from '@nestjs/testing';
import { PointsModule, ScoringRuleSets } from '../../src/modules/points';
import { RecordBattlePoints } from '../../src/modules/points/application/record-battle-points';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { UuidV7Generator } from '../../src/shared/kernel';
import { WorkerModule } from '../../src/worker.module';
import { testConfig } from '../support/test-app';

const ids = new UuidV7Generator();
const uuidv7 = () => ids.next();

describe('scoring rule sets', () => {
  let moduleRef: TestingModule;
  let ruleSets: ScoringRuleSets;
  let prisma: PrismaService;

  beforeAll(async () => {
    const config = testConfig();
    moduleRef = await Test.createTestingModule({ imports: [CoreModule.register(config), PointsModule] }).compile();
    await moduleRef.init();
    ruleSets = moduleRef.get(ScoringRuleSets);
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(() => moduleRef.close());

  it('activates versions one after another and keeps the old ones as RETIRED', async () => {
    const first = await ruleSets.activateRuleSet('MOTM', 'first', { points: 1 }, 'test');
    const same = await ruleSets.activateRuleSet('MOTM', 'first again', { points: 1 }, 'test');
    const second = await ruleSets.activateRuleSet('MOTM', 'second', { points: 2 }, 'test');

    expect(first).toEqual({ ruleSetId: expect.any(String), version: 1, activated: true });
    expect(same).toEqual({ ruleSetId: first.ruleSetId, version: 1, activated: false });
    expect(second).toEqual({ ruleSetId: expect.any(String), version: 2, activated: true });
    expect(await ruleSets.findActiveRuleSet('MOTM')).toMatchObject({ id: second.ruleSetId, config: { points: 2 } });
    const stored = await prisma.scoringRuleSet.findMany({ where: { gameType: 'MOTM' }, orderBy: { version: 'asc' } });
    expect(stored.map((row) => row.status)).toEqual(['RETIRED', 'ACTIVE']);
    const events = await prisma.outboxEvent.findMany({
      where: { type: 'ScoringRuleSetActivated', aggregateId: { in: [first.ruleSetId, second.ruleSetId] } },
    });
    expect(events).toHaveLength(2);
  });

  it('lets only one of two parallel activations take a version', async () => {
    const results = await Promise.all([
      ruleSets.activateRuleSet('PREDICTION', 'a', { points: 'a' }, 'test'),
      ruleSets.activateRuleSet('PREDICTION', 'b', { points: 'b' }, 'test'),
    ]);

    expect(results.map((result) => result.version).sort()).toEqual([1, 2]);
    expect(await prisma.scoringRuleSet.count({ where: { gameType: 'PREDICTION', status: 'ACTIVE' } })).toBe(1);
  });
});

describe('battle points in the worker', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [WorkerModule.register(testConfig())] }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(() => moduleRef.close());

  const createUser = async () => (await prisma.user.create({ data: { id: uuidv7() } })).id;

  it('records each earning human once when BattleCompleted is published, and announces it', async () => {
    const [winner, loser] = [await createUser(), await createUser()];
    const ruleSet = await prisma.scoringRuleSet.create({
      data: {
        id: uuidv7(),
        gameType: 'BATTLE',
        version: 100,
        name: 'test',
        config: {},
        createdAt: new Date(),
        createdBy: 'test',
      },
    });
    const battleId = uuidv7();
    const [winnerSeat, loserSeat] = [uuidv7(), uuidv7()];
    const endedAt = '2026-11-12T10:00:00.000Z';
    const payload = {
      battleId,
      mode: 'MATCHMAKING',
      gameType: 'BUZZER',
      hasBot: false,
      roomId: null,
      endedAt,
      endReason: 'COMPLETED',
      ruleSetId: ruleSet.id,
      participants: [
        {
          participantId: winnerSeat,
          kind: 'HUMAN',
          userId: winner,
          score: 5,
          placement: 1,
          outcome: 'WIN',
          points: 30,
        },
        { participantId: loserSeat, kind: 'HUMAN', userId: loser, score: 1, placement: 2, outcome: 'LOSS', points: 0 },
      ],
      questionResults: [],
    };
    await prisma.outboxEvent.create({
      data: {
        id: uuidv7(),
        type: 'BattleCompleted',
        version: 1,
        aggregateType: 'battle',
        aggregateId: battleId,
        payload,
        occurredAt: new Date(endedAt),
      },
    });

    const entriesOfBattle = () => prisma.pointEntry.findMany({ where: { sourceId: { in: [winnerSeat, loserSeat] } } });
    let entries = await entriesOfBattle();
    for (let waited = 0; entries.length === 0 && waited < 20_000; waited += 200) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      entries = await entriesOfBattle();
    }

    expect(entries).toEqual([
      expect.objectContaining({
        userId: winner,
        category: 'BATTLE',
        sourceType: 'BATTLE_PARTICIPANT',
        sourceId: winnerSeat,
        ruleSetId: ruleSet.id,
        points: 30,
        occurredAt: new Date(endedAt),
        context: { battleId, battleMode: 'MATCHMAKING', gameType: 'BUZZER', hasBot: false, roomId: null },
      }),
    ]);

    // A redelivered event changes nothing.
    const recordedAgain = await moduleRef.get(RecordBattlePoints).recordPointsOfBattle({
      ...payload,
      mode: 'MATCHMAKING',
      endedAt: new Date(endedAt),
      participants: [
        { participantId: winnerSeat, kind: 'HUMAN', userId: winner, points: 30 },
        { participantId: loserSeat, kind: 'HUMAN', userId: loser, points: 0 },
      ],
    });
    expect(recordedAgain).toBe(0);
    const announcements = await prisma.outboxEvent.findMany({
      where: { type: 'PointsRecorded', aggregateId: battleId },
    });
    expect(announcements.map((event) => event.payload)).toEqual([
      { userIds: [winner], categories: ['BATTLE'], occurredAtMin: endedAt, occurredAtMax: endedAt },
    ]);
  }, 30_000);
});
