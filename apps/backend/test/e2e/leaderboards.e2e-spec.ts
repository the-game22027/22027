import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { UpdateLeaderboards } from '../../src/modules/leaderboards/application/update-leaderboards';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { UuidV7Generator } from '../../src/shared/kernel';
import { WorkerModule } from '../../src/worker.module';
import { bearer, devSignIn, type SignedIn } from '../support/sign-in';
import { createApiTestApp, testConfig } from '../support/test-app';

const ids = new UuidV7Generator();
const SCORED_AT = new Date('2025-03-05T10:00:00Z'); // 2025-W10, March 2025

describe('leaderboards API (e2e)', () => {
  let app: NestExpressApplication;
  let worker: TestingModule;
  const players: Record<'top' | 'secondA' | 'secondB' | 'fourth' | 'none', SignedIn> = {} as never;

  const get = (path: string, as: SignedIn = players.none) =>
    request(app.getHttpServer())
      .get(path)
      .set(...bearer(as));
  const codeOf = (res: request.Response) => (res.body as { code: string }).code;
  interface Row {
    rank: number;
    user: { id: string };
    points: number;
    isMe: boolean;
  }
  const rowsOf = (res: request.Response) =>
    (res.body as { items: Row[] }).items.map((row) => [row.rank, row.user.id, row.points]);

  /** Four players with 50, 30, 30 and 10 battle points in 2025-W10, put on the boards by the projection. */
  beforeAll(async () => {
    app = await createApiTestApp();
    for (const name of ['top', 'secondA', 'secondB', 'fourth', 'none'] as const) players[name] = await devSignIn(app);

    worker = await Test.createTestingModule({
      imports: [WorkerModule.register(testConfig())],
    }).compile();
    await worker.init();
    const prisma = worker.get(PrismaService);
    const ruleSet = await prisma.scoringRuleSet.create({
      data: {
        id: ids.next(),
        gameType: 'BATTLE',
        version: 300,
        name: 'e2e',
        config: {},
        createdAt: new Date(),
        createdBy: 'test',
      },
    });
    const scores = { top: 50, secondA: 30, secondB: 30, fourth: 10 } as const;
    await prisma.pointEntry.createMany({
      data: Object.entries(scores).map(([name, points]) => ({
        id: ids.next(),
        userId: players[name as keyof typeof scores].userId,
        category: 'BATTLE' as const,
        sourceType: 'BATTLE_PARTICIPANT',
        sourceId: ids.next(),
        ruleSetId: ruleSet.id,
        points,
        occurredAt: SCORED_AT,
      })),
    });
    await worker.get(UpdateLeaderboards).updateLeaderboardsForRecordedPoints({
      userIds: Object.keys(scores).map((name) => players[name as keyof typeof scores].userId),
      categories: ['BATTLE'],
      occurredAtMin: SCORED_AT,
      occurredAtMax: SCORED_AT,
    });
  });

  // @nestjs-cls keeps one TransactionHost per process and the module created last owns it, so closing the
  // worker before the API would leave @Transactional() with a closed database client. Only tests share a process.
  afterAll(async () => {
    await worker.close();
    await app.close();
  });

  // The two players on 30 share rank 2; between them the order is by user id.
  const secondPlace = () => [players.secondA, players.secondB].sort((a, b) => a.userId.localeCompare(b.userId));

  it('requires an access token', async () => {
    await request(app.getHttpServer()).get('/v1/leaderboards/periods?kind=WEEKLY').expect(401);
  });

  it('lists the current week and the eleven before it, in Cairo time', async () => {
    const res = await get('/v1/leaderboards/periods?kind=WEEKLY').expect(200);
    const items = (res.body as { items: { key: string; status: string; startsAt: string }[] }).items;

    expect(items).toHaveLength(12);
    expect(items[0]?.status).toBe('OPEN');
    expect(items.slice(1).every((period) => period.status === 'CLOSED')).toBe(true);
    // Monday 00:00 in Cairo is 21:00 or 22:00 UTC on Sunday.
    expect(new Date(items[0]?.startsAt ?? '').getUTCDay()).toBe(0);
  });

  it('pages the board with shared ranks and marks the viewer', async () => {
    const [first, second] = secondPlace();
    const page1 = await get('/v1/leaderboards/WEEKLY/2025-W10?category=BATTLES&limit=2', first).expect(200);

    expect(page1.body).toMatchObject({
      period: { kind: 'WEEKLY', key: '2025-W10', startsAt: '2025-03-02T22:00:00.000Z', status: 'CLOSED' },
      category: 'BATTLES',
    });
    expect(rowsOf(page1)).toEqual([
      [1, players.top.userId, 50],
      [2, first.userId, 30],
    ]);
    expect((page1.body as { items: Row[] }).items.map((row) => row.isMe)).toEqual([false, true]);

    const cursor = (page1.body as { nextCursor: string }).nextCursor;
    const page2 = await get(`/v1/leaderboards/WEEKLY/2025-W10?category=BATTLES&limit=2&cursor=${cursor}`).expect(200);
    expect(rowsOf(page2)).toEqual([
      [2, second.userId, 30],
      [4, players.fourth.userId, 10],
    ]);
    expect((page2.body as { nextCursor: string | null }).nextCursor).toBeNull();

    const month = await get('/v1/leaderboards/MONTHLY/2025-03?category=BATTLES').expect(200);
    expect(rowsOf(month)).toHaveLength(4);
  });

  it("gives a player's rank with two neighbours on each side", async () => {
    const [first, second] = secondPlace();
    const res = await get('/v1/leaderboards/WEEKLY/2025-W10/me?category=BATTLES', second).expect(200);

    expect(res.body).toMatchObject({ rank: 2, points: 30 });
    expect((res.body as { around: Row[] }).around.map((row) => [row.rank, row.user.id, row.isMe])).toEqual([
      [1, players.top.userId, false],
      [2, first.userId, false],
      [2, second.userId, true],
      [4, players.fourth.userId, false],
    ]);

    const nobody = await get('/v1/leaderboards/WEEKLY/2025-W10/me?category=BATTLES').expect(200);
    expect(nobody.body).toEqual({ rank: null, points: 0, around: [] });
  });

  it('shows an empty board for a period or category without points', async () => {
    const predictions = await get('/v1/leaderboards/WEEKLY/2025-W10?category=PREDICTIONS').expect(200);
    expect(predictions.body).toMatchObject({ items: [], nextCursor: null });
    const current = await get('/v1/leaderboards/SEASONAL/2025-26?category=PREDICTIONS').expect(200);
    expect(current.body).toMatchObject({ period: { kind: 'SEASONAL', key: '2025-26' }, items: [] });
  });

  it('refuses unknown periods, bad parameters and altered cursors', async () => {
    expect(codeOf(await get('/v1/leaderboards/WEEKLY/2025-W99?category=BATTLES').expect(404))).toBe('PERIOD_NOT_FOUND');
    expect(codeOf(await get('/v1/leaderboards/SEASONAL/1999-00?category=BATTLES').expect(404))).toBe(
      'PERIOD_NOT_FOUND',
    );
    expect(codeOf(await get('/v1/leaderboards/WEEKLY/current').expect(400))).toBe('VALIDATION_FAILED');
    expect(codeOf(await get('/v1/leaderboards/DAILY/current?category=BATTLES').expect(400))).toBe('VALIDATION_FAILED');
    expect(codeOf(await get('/v1/leaderboards/WEEKLY/2025-W10?category=BATTLES&cursor=abc').expect(400))).toBe(
      'INVALID_CURSOR',
    );
  });
});
