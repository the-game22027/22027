import { jest } from '@jest/globals';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { CommandFactory } from 'nest-commander';
import request from 'supertest';
import { CliModule } from '../../src/cli.module';
import { FootballSyncService } from '../../src/modules/football/application/football-sync.service';
import { MatchSimulator } from '../../src/modules/football/application/match-simulator';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { bearer, devSignIn } from '../support/sign-in';
import { createApiTestApp, testConfig } from '../support/test-app';

const createCli = (env: Record<string, string> = {}) =>
  CommandFactory.createWithoutRunning(CliModule.register(testConfig(env)), {
    logger: false,
    serviceErrorHandler: (error) => {
      throw error;
    },
  });

async function runCli(...args: string[]): Promise<void> {
  const cli = await createCli();
  const argv = process.argv;
  const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  process.argv = ['node', 'cli', ...args];
  try {
    await CommandFactory.runApplication(cli);
  } finally {
    process.argv = argv;
    stdout.mockRestore();
    await cli.close();
  }
}

describe('simulator CLI (e2e)', () => {
  let database: NestExpressApplication;
  let prisma: PrismaService;

  // TransactionHost is a per-process singleton owned by the newest app, so each HTTP call boots its own API.
  const predictable = async (id: string) => {
    const api = await createApiTestApp();
    try {
      const res = await request(api.getHttpServer())
        .get(`/v1/matches/${id}`)
        .set(...bearer(await devSignIn(api)))
        .expect(200);
      return (res.body as { predictable: boolean }).predictable;
    } finally {
      await api.close();
    }
  };
  const eventCount = (type: string) => prisma.outboxEvent.count({ where: { type } });
  const nextScheduled = () =>
    prisma.match.findFirstOrThrow({
      where: { provider: 'mock', status: 'SCHEDULED' },
      orderBy: { kickoffAt: 'asc' },
    });

  beforeAll(async () => {
    database = await createApiTestApp();
    prisma = database.get(PrismaService);
    const cli = await createCli();
    await cli.get(FootballSyncService, { strict: false }).run();
    await cli.close();
  }, 60_000);

  afterAll(() => database.close());

  it('mock:run-day plays a matchday and publishes its lifecycle events', async () => {
    const opener = await nextScheduled();
    expect(await predictable(opener.id)).toBe(true);
    const scheduledBefore = await prisma.match.count({ where: { provider: 'mock', status: 'SCHEDULED' } });
    const [startedBefore, finishedBefore] = [await eventCount('MatchStarted'), await eventCount('MatchFinished')];

    await runCli('mock:run-day', '--speed', '100000000x');

    const played = scheduledBefore - (await prisma.match.count({ where: { provider: 'mock', status: 'SCHEDULED' } }));
    expect(played).toBeGreaterThan(1);
    expect((await eventCount('MatchStarted')) - startedBefore).toBe(played);
    expect((await eventCount('MatchFinished')) - finishedBefore).toBe(played);
    expect(await prisma.match.findUniqueOrThrow({ where: { id: opener.id } })).toMatchObject({
      status: 'FINISHED',
      resultVersion: 1,
    });
    expect(await predictable(opener.id)).toBe(false);
  }, 60_000);

  it('a later sync does not overwrite a simulated match', async () => {
    const { id } = await nextScheduled();
    await runCli('mock:finish', id, '3-2');

    const cli = await createCli();
    await cli.get(FootballSyncService, { strict: false }).run();
    await cli.close();

    expect(await prisma.match.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'FINISHED',
      homeScore: 3,
      awayScore: 2,
    });
  }, 60_000);

  it('reports a bad argument instead of running', async () => {
    await expect(runCli('mock:score', (await nextScheduled()).id, 'three-nil')).rejects.toThrow('not a score');
    await expect(runCli('mock:run-day', '--speed', 'fast')).rejects.toThrow('not a speed');
  });

  it('does not exist in production', async () => {
    const cli = await createCli({ NODE_ENV: 'production' });
    expect(() => cli.get(MatchSimulator, { strict: false })).toThrow();
    await cli.close();
  });
});
