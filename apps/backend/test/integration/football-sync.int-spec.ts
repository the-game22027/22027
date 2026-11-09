import { Test, type TestingModule } from '@nestjs/testing';
import { FootballSyncService } from '../../src/modules/football/application/football-sync.service';
import { FootballIngestionModule } from '../../src/modules/football/football-ingestion.module';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { testConfig } from '../support/test-app';

describe('football sync with the mock provider', () => {
  let moduleRef: TestingModule;
  let sync: FootballSyncService;
  let prisma: PrismaService;

  const mockMatches = { provider: 'mock' };

  beforeAll(async () => {
    const config = testConfig();
    moduleRef = await Test.createTestingModule({
      imports: [CoreModule.register(config), FootballIngestionModule],
    }).compile();
    await moduleRef.init();
    sync = moduleRef.get(FootballSyncService);
    prisma = moduleRef.get(PrismaService);
    await sync.run();
  }, 60_000);

  afterAll(() => moduleRef.close());

  it('loads the competitions, with Arabic and English names', async () => {
    const league = await prisma.competition.findUniqueOrThrow({ where: { code: 'ENG-PL' } });
    expect(league.names).toEqual({ en: 'Premier League', ar: 'الدوري الإنجليزي الممتاز' });
    expect(await prisma.season.count({ where: { competitionId: league.id, isCurrent: true } })).toBe(1);
  });

  it('loads matches around today in every state', async () => {
    const statuses = await prisma.match.groupBy({ by: ['status'], where: mockMatches });
    expect(statuses.map((row) => row.status).sort()).toEqual(['FINISHED', 'LIVE', 'SCHEDULED']);
  });

  it('gives every match a squad of 36', async () => {
    const match = await prisma.match.findFirstOrThrow({
      where: mockMatches,
      include: { squad: true },
    });
    expect(match.squad).toHaveLength(36);
    expect(await prisma.match.count({ where: { ...mockMatches, squad: { none: {} } } })).toBe(0);
  });

  it('a second run creates nothing and announces nothing', async () => {
    const before = {
      matches: await prisma.match.count({ where: mockMatches }),
      teams: await prisma.team.count(),
      players: await prisma.player.count(),
      events: await prisma.outboxEvent.count({ where: { aggregateType: 'match' } }),
    };

    const stats = await sync.run();

    expect(stats).toMatchObject({ CREATED: 0, UPDATED: 0, REJECTED: 0, squads: 0 });
    expect({
      matches: await prisma.match.count({ where: mockMatches }),
      teams: await prisma.team.count(),
      players: await prisma.player.count(),
      events: await prisma.outboxEvent.count({ where: { aggregateType: 'match' } }),
    }).toEqual(before);
  }, 60_000);

  it('does not let a later sync undo a newer update', async () => {
    const match = await prisma.match.findFirstOrThrow({ where: { ...mockMatches, status: 'SCHEDULED' } });
    await prisma.match.update({
      where: { id: match.id },
      data: { status: 'POSTPONED', providerUpdatedAt: new Date(Date.now() + 60_000) },
    });

    await sync.run();

    expect((await prisma.match.findUniqueOrThrow({ where: { id: match.id } })).status).toBe('POSTPONED');
  }, 60_000);

  it('records each run with its stats', async () => {
    const run = await prisma.providerSyncRun.findFirstOrThrow({
      where: { provider: 'mock' },
      orderBy: { startedAt: 'desc' },
    });
    expect(run).toMatchObject({ status: 'SUCCEEDED', kind: 'FIXTURES', error: null });
    expect(run.finishedAt).not.toBeNull();
    expect(run.stats).toMatchObject({ REJECTED: 0 });
  });
});
