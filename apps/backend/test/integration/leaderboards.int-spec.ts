import { Test, type TestingModule } from '@nestjs/testing';
import { UpdateLeaderboards } from '../../src/modules/leaderboards/application/update-leaderboards';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { UuidV7Generator } from '../../src/shared/kernel';
import { WorkerModule } from '../../src/worker.module';
import { testConfig } from '../support/test-app';

const ids = new UuidV7Generator();
const ENDED_AT = '2025-03-05T10:00:00.000Z'; // Wednesday of 2025-W10, before the first dev season

describe('leaderboards in the worker', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [WorkerModule.register(testConfig())] }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(() => moduleRef.close());

  const createUser = async () => (await prisma.user.create({ data: { id: ids.next() } })).id;
  const rowsOf = (userId: string) =>
    prisma.leaderboardEntry.findMany({
      where: { userId },
      include: { period: true },
      orderBy: { period: { kind: 'asc' } },
    });

  it('turns a finished battle into rows on every board period it belongs to', async () => {
    const [winner, loser] = [await createUser(), await createUser()];
    const ruleSet = await prisma.scoringRuleSet.create({
      data: {
        id: ids.next(),
        gameType: 'BATTLE',
        version: 200,
        name: 'test',
        config: {},
        createdAt: new Date(),
        createdBy: 'test',
      },
    });
    const battleId = ids.next();
    await prisma.outboxEvent.create({
      data: {
        id: ids.next(),
        type: 'BattleCompleted',
        version: 1,
        aggregateType: 'battle',
        aggregateId: battleId,
        occurredAt: new Date(ENDED_AT),
        payload: {
          battleId,
          mode: 'MATCHMAKING',
          gameType: 'BUZZER',
          hasBot: false,
          roomId: null,
          endedAt: ENDED_AT,
          endReason: 'COMPLETED',
          ruleSetId: ruleSet.id,
          participants: [
            { participantId: ids.next(), kind: 'HUMAN', userId: winner, points: 30 },
            { participantId: ids.next(), kind: 'HUMAN', userId: loser, points: 0 },
          ],
          questionResults: [],
        },
      },
    });

    let rows = await rowsOf(winner);
    for (let waited = 0; rows.length < 3 && waited < 20_000; waited += 200) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      rows = await rowsOf(winner);
    }

    // No SEASONAL row: March 2025 is before the first dev season.
    expect(rows.map((row) => [row.period.kind, row.period.category, row.period.periodKey, Number(row.points)])).toEqual(
      [
        ['WEEKLY', 'BATTLES', '2025-W10', 30],
        ['MONTHLY', 'BATTLES', '2025-03', 30],
        ['ALL_TIME', 'BATTLES', 'all', expect.any(Number)],
      ],
    );
    expect(rows[0]?.period).toMatchObject({
      timezone: 'Africa/Cairo',
      startsAt: new Date('2025-03-02T22:00:00Z'),
      endsAt: new Date('2025-03-09T22:00:00Z'),
    });
    expect(await rowsOf(loser)).toEqual([]);
  }, 30_000);

  it('recomputes totals from the ledger: a redelivery changes nothing, a superseded entry removes the row', async () => {
    const player = await createUser();
    const ruleSet = await prisma.scoringRuleSet.create({
      data: {
        id: ids.next(),
        gameType: 'BATTLE',
        version: 201,
        name: 'test',
        config: {},
        createdAt: new Date(),
        createdBy: 'test',
      },
    });
    const entry = (points: number) => ({
      id: ids.next(),
      userId: player,
      category: 'BATTLE' as const,
      sourceType: 'BATTLE_PARTICIPANT',
      sourceId: ids.next(),
      ruleSetId: ruleSet.id,
      points,
      occurredAt: new Date(ENDED_AT),
    });
    const [first, second] = [entry(30), entry(10)];
    await prisma.pointEntry.createMany({ data: [first, second] });
    const update = moduleRef.get(UpdateLeaderboards);
    const recorded = {
      userIds: [player],
      categories: ['BATTLE'],
      occurredAtMin: new Date(ENDED_AT),
      occurredAtMax: new Date(ENDED_AT),
    };
    const weeklyPoints = async () =>
      (await rowsOf(player)).filter((row) => row.period.kind === 'WEEKLY').map((row) => Number(row.points));

    await update.updateLeaderboardsForRecordedPoints(recorded);
    await update.updateLeaderboardsForRecordedPoints(recorded);
    expect(await weeklyPoints()).toEqual([40]);

    await prisma.pointEntry.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: { supersededAt: new Date() },
    });
    await update.updateLeaderboardsForRecordedPoints(recorded);
    expect(await weeklyPoints()).toEqual([]);
  });

  it('gives MOTM points no board (DEC-08)', async () => {
    const player = await createUser();
    await moduleRef.get(UpdateLeaderboards).updateLeaderboardsForRecordedPoints({
      userIds: [player],
      categories: ['MOTM'],
      occurredAtMin: new Date(ENDED_AT),
      occurredAtMax: new Date(ENDED_AT),
    });
    expect(await rowsOf(player)).toEqual([]);
  });
});
