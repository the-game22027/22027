import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import {
  ApplyProviderMatchUpdate,
  type ProviderMatchUpdate,
} from '../../src/modules/football/application/apply-provider-match-update';
import { FootballJobsModule } from '../../src/modules/football/football-jobs.module';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { createFixtureWorld } from '../support/football';
import { testConfig } from '../support/test-app';

const at = (time: string) => new Date(`2026-11-09T${time}:00Z`);

describe('applying provider match updates', () => {
  let moduleRef: TestingModule;
  let matches: ApplyProviderMatchUpdate;
  let prisma: PrismaService;
  let base: Omit<ProviderMatchUpdate, 'providerMatchId'>;

  const noPlay = {
    startedAt: null,
    endedAt: null,
    homeScore: null,
    awayScore: null,
    decidedBy: null,
    homePenalties: null,
    awayPenalties: null,
  };
  const update = (providerMatchId: string, overrides: Partial<ProviderMatchUpdate> = {}): ProviderMatchUpdate => ({
    ...base,
    providerMatchId,
    ...overrides,
  });
  const final = (updatedAt: Date, homeScore = 2): Partial<ProviderMatchUpdate> => ({
    status: 'FINISHED',
    endedAt: at('21:55'),
    homeScore,
    awayScore: 1,
    decidedBy: 'REGULAR_TIME',
    updatedAt,
  });
  const stored = (providerMatchId: string) =>
    prisma.match.findUniqueOrThrow({
      where: { provider_providerMatchId: { provider: 'test', providerMatchId } },
    });
  const eventTypes = async (providerMatchId: string) => {
    const { id } = await stored(providerMatchId);
    const events = await prisma.outboxEvent.findMany({ where: { aggregateId: id }, orderBy: { id: 'asc' } });
    return events.map((event) => event.type);
  };

  beforeAll(async () => {
    const config = testConfig();
    moduleRef = await Test.createTestingModule({
      imports: [CoreModule.register(config), FootballJobsModule],
    }).compile();
    await moduleRef.init();
    matches = moduleRef.get(ApplyProviderMatchUpdate);
    prisma = moduleRef.get(PrismaService);
    const world = await createFixtureWorld(prisma);
    base = {
      provider: 'test',
      refs: {
        competitionId: world.competition.id,
        seasonId: world.season.id,
        homeTeamId: world.home.id,
        awayTeamId: world.away.id,
        roundLabel: 'Round 1',
      },
      status: 'SCHEDULED',
      kickoffAt: at('20:00'),
      updatedAt: at('10:00'),
      ...noPlay,
    };
  });

  afterAll(() => moduleRef.close());

  it('creates a match the first time and announces it once', async () => {
    const id = randomUUID();

    expect(await matches.apply(update(id))).toBe('CREATED');

    expect(await stored(id)).toMatchObject({ status: 'SCHEDULED', version: 0, roundLabel: 'Round 1' });
    expect(await eventTypes(id)).toEqual(['MatchScheduled']);
  });

  it('does not announce the result of a match first seen as finished', async () => {
    const id = randomUUID();

    expect(await matches.apply(update(id, final(at('22:00'))))).toBe('CREATED');

    expect(await stored(id)).toMatchObject({ status: 'FINISHED', resultVersion: 1, startedAt: at('20:00') });
    expect(await eventTypes(id)).toEqual(['MatchScheduled']);
  });

  it('delivering the same update twice changes nothing', async () => {
    const id = randomUUID();
    await matches.apply(update(id));
    await matches.apply(update(id, final(at('22:00'))));
    const before = await stored(id);

    expect(await matches.apply(update(id, final(at('22:00'))))).toBe('STALE');

    expect((await stored(id)).version).toBe(before.version);
    expect(await eventTypes(id)).toEqual(['MatchScheduled', 'MatchStarted', 'MatchFinished']);
  });

  it('ignores an old update that arrives late', async () => {
    const id = randomUUID();
    await matches.apply(update(id));
    await matches.apply(update(id, final(at('22:00'))));

    expect(await matches.apply(update(id, { status: 'LIVE', updatedAt: at('20:30') }))).toBe('STALE');

    expect((await stored(id)).status).toBe('FINISHED');
  });

  it('runs a whole match and raises the version on each real change', async () => {
    const id = randomUUID();
    await matches.apply(update(id));
    await matches.apply(update(id, { status: 'LIVE', updatedAt: at('20:01'), homeScore: 0, awayScore: 0 }));
    await matches.apply(update(id, final(at('22:00'))));
    await matches.apply(update(id, final(at('23:00'), 3)));

    expect(await stored(id)).toMatchObject({ status: 'FINISHED', homeScore: 3, resultVersion: 2, version: 3 });
    expect(await eventTypes(id)).toEqual(['MatchScheduled', 'MatchStarted', 'MatchFinished', 'MatchResultCorrected']);
  });

  it('writes the score and times into the event payload', async () => {
    const id = randomUUID();
    await matches.apply(update(id));
    await matches.apply(update(id, { status: 'LIVE', updatedAt: at('20:01') }));
    await matches.apply(
      update(id, { ...final(at('22:00')), homePenalties: 4, awayPenalties: 3, decidedBy: 'PENALTIES' }),
    );

    const { id: matchId } = await stored(id);
    const event = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: matchId, type: 'MatchFinished' } });
    expect(event.payload).toEqual({
      matchId,
      endedAt: at('21:55').toISOString(),
      score: { home: 2, away: 1, decidedBy: 'PENALTIES', penalties: { home: 4, away: 3 } },
    });
  });

  it('leaves the match alone when the transition is illegal', async () => {
    const id = randomUUID();
    await matches.apply(update(id));
    await matches.apply(update(id, final(at('22:00'))));

    expect(await matches.apply(update(id, { status: 'LIVE', updatedAt: at('23:00') }))).toBe('REJECTED');

    expect((await stored(id)).status).toBe('FINISHED');
  });

  it('records the newest provider time even when nothing changed', async () => {
    const id = randomUUID();
    await matches.apply(update(id));

    expect(await matches.apply(update(id, { updatedAt: at('11:00') }))).toBe('UNCHANGED');

    expect(await stored(id)).toMatchObject({ providerUpdatedAt: at('11:00'), version: 0 });
  });

  it('concurrent first deliveries create one match and one event', async () => {
    const id = randomUUID();

    const outcomes = await Promise.all(Array.from({ length: 5 }, () => matches.apply(update(id))));

    expect(outcomes.filter((outcome) => outcome === 'CREATED')).toHaveLength(1);
    expect(await eventTypes(id)).toEqual(['MatchScheduled']);
  });

  it('concurrent final whistles announce the result once', async () => {
    const id = randomUUID();
    await matches.apply(update(id, { status: 'LIVE', updatedAt: at('20:01') }));

    await Promise.all(Array.from({ length: 5 }, () => matches.apply(update(id, final(at('22:00'))))));

    expect(await stored(id)).toMatchObject({ resultVersion: 1 });
    expect((await eventTypes(id)).filter((type) => type === 'MatchFinished')).toHaveLength(1);
  });
});
