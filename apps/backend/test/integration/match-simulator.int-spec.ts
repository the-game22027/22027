import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { ApplyProviderMatchUpdate } from '../../src/modules/football/application/apply-provider-match-update';
import { MatchScenarios, type ScenarioName } from '../../src/modules/football/application/match-scenarios';
import { MatchSimulator } from '../../src/modules/football/application/match-simulator';
import { MatchdayRunner } from '../../src/modules/football/application/matchday-runner';
import type { MatchRefs } from '../../src/modules/football/application/ports/match-write-repository';
import { FootballSimulatorModule } from '../../src/modules/football/football-simulator.module';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { createFixtureWorld } from '../support/football';
import { testConfig } from '../support/test-app';

const ANCHOR = new Date('2026-11-09T10:00:00Z');

describe('the match simulator', () => {
  let moduleRef: TestingModule;
  let simulator: MatchSimulator;
  let runner: MatchdayRunner;
  let scenarios: MatchScenarios;
  let updates: ApplyProviderMatchUpdate;
  let prisma: PrismaService;
  let refs: MatchRefs;
  let earliest = new Date('2000-01-01T12:00:00Z').getTime();

  const seedMatch = async (provider = 'mock', kickoffAt = new Date((earliest -= 86_400_000 * 2))) => {
    const providerMatchId = randomUUID();
    await updates.apply({
      provider,
      providerMatchId,
      refs,
      status: 'SCHEDULED',
      kickoffAt,
      startedAt: null,
      endedAt: null,
      homeScore: null,
      awayScore: null,
      decidedBy: null,
      homePenalties: null,
      awayPenalties: null,
      updatedAt: ANCHOR,
    });
    const { id } = await prisma.match.findUniqueOrThrow({
      where: { provider_providerMatchId: { provider, providerMatchId } },
    });
    return id;
  };
  const stored = (id: string) => prisma.match.findUniqueOrThrow({ where: { id } });
  const eventTypes = async (id: string) => {
    const events = await prisma.outboxEvent.findMany({ where: { aggregateId: id }, orderBy: { id: 'asc' } });
    return events.map((event) => event.type);
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [CoreModule.register(testConfig()), FootballSimulatorModule],
    }).compile();
    await moduleRef.init();
    simulator = moduleRef.get(MatchSimulator);
    runner = moduleRef.get(MatchdayRunner);
    scenarios = moduleRef.get(MatchScenarios);
    updates = moduleRef.get(ApplyProviderMatchUpdate);
    prisma = moduleRef.get(PrismaService);
    const world = await createFixtureWorld(prisma);
    refs = {
      competitionId: world.competition.id,
      seasonId: world.season.id,
      homeTeamId: world.home.id,
      awayTeamId: world.away.id,
      roundLabel: 'Round 1',
    };
  });

  afterAll(() => moduleRef.close());

  it('plays a match from kickoff to full time', async () => {
    const id = await seedMatch();
    await simulator.kickoff(id);
    expect(await stored(id)).toMatchObject({ status: 'LIVE', homeScore: 0, awayScore: 0 });

    await simulator.score(id, { home: 2, away: 1 });
    await simulator.finish(id);

    const match = await stored(id);
    expect(match).toMatchObject({ status: 'FINISHED', homeScore: 2, awayScore: 1, decidedBy: 'REGULAR_TIME' });
    expect(match.endedAt).not.toBeNull();
    expect(await eventTypes(id)).toEqual(['MatchScheduled', 'MatchStarted', 'MatchFinished']);
  });

  it('wins over the seed, even when the steps share a millisecond', async () => {
    const id = await seedMatch();
    const outcomes = [
      await simulator.kickoff(id),
      await simulator.score(id, { home: 1, away: 0 }),
      await simulator.score(id, { home: 2, away: 0 }),
      await simulator.score(id, { home: 3, away: 0 }),
    ];
    expect(outcomes).toEqual(['UPDATED', 'UPDATED', 'UPDATED', 'UPDATED']);
    expect((await stored(id)).providerUpdatedAt!.getTime()).toBeGreaterThan(ANCHOR.getTime());
  });

  it('corrects a result and an end time', async () => {
    const id = await seedMatch();
    await simulator.finish(id, { home: 1, away: 1 });
    await simulator.correctResult(id, { home: 2, away: 1 });
    const endedAt = new Date('2026-11-09T22:00:00Z');
    await simulator.correctEndTime(id, endedAt);

    expect(await stored(id)).toMatchObject({ homeScore: 2, awayScore: 1, resultVersion: 2, endedAt });
    expect(await eventTypes(id)).toEqual([
      'MatchScheduled',
      'MatchStarted',
      'MatchFinished',
      'MatchResultCorrected',
      'MatchEndTimeCorrected',
    ]);
  });

  it('postpones, reschedules and cancels', async () => {
    const id = await seedMatch();
    const kickoffAt = new Date('2026-12-01T20:00:00Z');
    await simulator.postpone(id);
    await simulator.reschedule(id, kickoffAt);
    await simulator.cancel(id);

    expect(await stored(id)).toMatchObject({ status: 'CANCELLED', kickoffAt });
    expect(await eventTypes(id)).toEqual(['MatchScheduled', 'MatchPostponed', 'MatchKickoffChanged', 'MatchCancelled']);
  });

  it('refuses a move the state machine forbids', async () => {
    const id = await seedMatch();
    await simulator.finish(id, { home: 1, away: 0 });
    await expect(simulator.kickoff(id)).rejects.toThrow('Match is FINISHED, so it cannot become LIVE.');
  });

  it('refuses to correct a match that has not finished, or score one that is not live', async () => {
    const id = await seedMatch();
    await expect(simulator.correctResult(id, { home: 1, away: 0 })).rejects.toThrow('this needs it to be FINISHED');
    await expect(simulator.score(id, { home: 1, away: 0 })).rejects.toThrow('this needs it to be LIVE');
    expect((await stored(id)).status).toBe('SCHEDULED');
  });

  it('does not touch a real provider match', async () => {
    const id = await seedMatch('real-provider');
    await expect(simulator.kickoff(id)).rejects.toThrow('Match not found.');
    expect((await stored(id)).status).toBe('SCHEDULED');
  });

  it('runs the next matchday and leaves later matches alone', async () => {
    const kickoff = (hour: number) => new Date(Date.UTC(1990, 0, 1, hour));
    const first = await seedMatch('mock', kickoff(15));
    const second = await seedMatch('mock', kickoff(18));
    const nextDay = await seedMatch('mock', new Date(Date.UTC(1990, 0, 3, 15)));

    const seen: string[] = [];
    const result = await runner.run(100_000_000, (step) => seen.push(step.kind));

    expect(result.matches).toBe(2);
    expect(result.steps).toBe(seen.length);
    for (const id of [first, second]) {
      expect((await stored(id)).status).toBe('FINISHED');
      expect(await eventTypes(id)).toEqual(['MatchScheduled', 'MatchStarted', 'MatchFinished']);
    }
    expect((await stored(nextDay)).status).toBe('SCHEDULED');
    await simulator.cancel(nextDay);
  });

  it.each<[ScenarioName, string[]]>([
    ['kickoff-change', ['MatchScheduled', 'MatchKickoffChanged']],
    ['postponed', ['MatchScheduled', 'MatchPostponed', 'MatchKickoffChanged']],
    ['result-corrected', ['MatchScheduled', 'MatchStarted', 'MatchFinished', 'MatchResultCorrected']],
    ['abandoned', ['MatchScheduled', 'MatchStarted', 'MatchAbandoned']],
  ])('plays the %s scenario on the next match', async (name, expected) => {
    const id = await seedMatch('mock', new Date((earliest -= 86_400_000 * 2)));
    expect(await scenarios.play(name)).toBe(id);
    expect(await eventTypes(id)).toEqual(expected);
  });
});
