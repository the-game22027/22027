import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { PredictionsFacade } from '../../src/modules/predictions/application/predictions.facade';
import {
  MatchNotPredictableError,
  PredictionLockedError,
} from '../../src/modules/predictions/domain/prediction-errors';
import { PredictionsModule } from '../../src/modules/predictions/predictions.module';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { createFixtureWorld } from '../support/football';
import { testConfig } from '../support/test-app';

const FUTURE = '2040-01-01T20:00:00Z';
const score = (home: number, away: number) => [{ type: 'EXACT_SCORE', home, away }];

describe('submitting predictions', () => {
  let moduleRef: TestingModule;
  let predictions: PredictionsFacade;
  let prisma: PrismaService;
  let world: Awaited<ReturnType<typeof createFixtureWorld>>;

  const newUser = async () => (await prisma.user.create({ data: { id: randomUUID() } })).id;
  const revisionsOf = (predictionId: string) =>
    prisma.predictionRevision.findMany({ where: { predictionId }, orderBy: { revision: 'asc' } });
  const setup = async (kickoffAt = FUTURE) => ({
    userId: await newUser(),
    matchId: (await world.createMatch(kickoffAt)).id,
  });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [CoreModule.register(testConfig()), PredictionsModule],
    }).compile();
    await moduleRef.init();
    predictions = moduleRef.get(PredictionsFacade);
    prisma = moduleRef.get(PrismaService);
    world = await createFixtureWorld(prisma);
  });

  afterAll(() => moduleRef.close());

  it('saves the first prediction as revision 1, with its pick and a snapshot', async () => {
    const key = await setup();
    const saved = await predictions.submit(key, score(2, 1));

    expect(saved).toMatchObject({ revision: 1, status: 'ACTIVE', score: { home: 2, away: 1 } });
    expect(await prisma.predictionPick.findMany({ where: { predictionId: saved.id } })).toEqual([
      expect.objectContaining({ pickType: 'EXACT_SCORE', homeScore: 2, awayScore: 1 }),
    ]);
    expect((await revisionsOf(saved.id)).map((row) => row.picks)).toEqual([score(2, 1)]);
  });

  it('adds a revision on each real edit and keeps the history', async () => {
    const key = await setup();
    await predictions.submit(key, score(2, 1));
    const edited = await predictions.submit(key, score(3, 0));

    expect(edited).toMatchObject({ revision: 2, score: { home: 3, away: 0 } });
    expect((await revisionsOf(edited.id)).map((row) => row.picks)).toEqual([score(2, 1), score(3, 0)]);
  });

  it('adds no revision when the picks did not change', async () => {
    const key = await setup();
    const first = await predictions.submit(key, score(1, 1));
    const again = await predictions.submit(key, score(1, 1));

    expect(again.revision).toBe(1);
    expect(again.updatedAt).toEqual(first.updatedAt);
    expect(await revisionsOf(first.id)).toHaveLength(1);
  });

  it('keeps one prediction when the same user submits five times at once', async () => {
    const key = await setup();
    const results = await Promise.all([1, 2, 3, 4, 5].map((home) => predictions.submit(key, score(home, 0))));

    expect(new Set(results.map((result) => result.id)).size).toBe(1);
    const stored = await prisma.prediction.findUniqueOrThrow({ where: { userId_matchId: key } });
    expect(stored.revision).toBe(5);
    expect((await revisionsOf(stored.id)).map((row) => row.revision)).toEqual([1, 2, 3, 4, 5]);
  });

  it('refuses a match that already kicked off, and saves nothing', async () => {
    const key = await setup('2020-01-01T20:00:00Z');
    await expect(predictions.submit(key, score(1, 0))).rejects.toThrow(PredictionLockedError);
    expect(await prisma.prediction.count({ where: key })).toBe(0);
  });

  it('refuses a match that is live even before its kickoff time', async () => {
    const key = await setup();
    await prisma.match.update({ where: { id: key.matchId }, data: { status: 'LIVE' } });
    await expect(predictions.submit(key, score(1, 0))).rejects.toThrow(PredictionLockedError);
  });

  it('refuses a postponed match with its own error', async () => {
    const userId = await newUser();
    const match = await world.createMatch(FUTURE, 'POSTPONED');
    await expect(predictions.submit({ userId, matchId: match.id }, score(1, 0))).rejects.toThrow(
      MatchNotPredictableError,
    );
  });

  it('refuses when kickoff is moved earlier while the prediction waits for the match', async () => {
    const key = await setup();

    let pending: Promise<unknown> | undefined;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM matches WHERE id = ${key.matchId}::uuid FOR UPDATE`;
      pending = predictions.submit(key, score(1, 0)).catch((error: unknown) => error);
      await sleep(200);
      await tx.match.update({ where: { id: key.matchId }, data: { kickoffAt: new Date('2020-01-01T20:00:00Z') } });
    });

    expect(await pending).toBeInstanceOf(PredictionLockedError);
    expect(await prisma.prediction.count({ where: key })).toBe(0);
  });

  it('accepts only what the database clock places before kickoff', async () => {
    const { matchId } = await setup();
    const [{ kickoff }] = await prisma.$queryRaw<{ kickoff: Date }[]>`
      UPDATE matches SET kickoff_at = now() + interval '800 milliseconds'
      WHERE id = ${matchId}::uuid RETURNING kickoff_at AS kickoff`;

    const attempts: Promise<unknown>[] = [];
    for (let attempt = 0; attempt < 32; attempt++) {
      const userId = await newUser();
      attempts.push(predictions.submit({ userId, matchId }, score(1, 0)).catch((error: unknown) => error));
      await sleep(50);
    }
    const results = await Promise.all(attempts);

    const refused = results.filter((result) => result instanceof PredictionLockedError);
    expect(refused.length).toBeGreaterThan(0);
    expect(refused.length).toBeLessThan(results.length);
    const revisions = await prisma.predictionRevision.findMany({ where: { prediction: { matchId } } });
    expect(revisions).toHaveLength(results.length - refused.length);
    for (const revision of revisions) {
      expect(revision.submittedAt.getTime()).toBeLessThanOrEqual(kickoff.getTime());
    }
  }, 30_000);
});
