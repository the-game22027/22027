import { Inject, Injectable } from '@nestjs/common';
import { AppConfig } from '@shared/infrastructure/config';
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from '@shared/kernel';
import { type ApplyOutcome, ApplyProviderMatchUpdate } from './apply-provider-match-update';
import {
  FOOTBALL_DATA_PROVIDER,
  type FootballDataProvider,
  type ProviderMatch,
  type ProviderSquadPlayer,
  type ProviderTeam,
} from './ports/football-data-provider';
import {
  type CompetitionKeys,
  FOOTBALL_REFERENCE_REPOSITORY,
  type FootballReferenceRepository,
} from './ports/football-reference-repository';

const DAY = 24 * 60 * 60 * 1000;

export type SyncStats = Record<ApplyOutcome, number> & { squads: number };

const lookup = <T>(map: ReadonlyMap<string, T>, key: string): T => {
  const value = map.get(key);
  if (value === undefined) throw new Error(`Provider data refers to unknown "${key}"`);
  return value;
};

@Injectable()
export class FootballSyncService {
  constructor(
    @Inject(FOOTBALL_DATA_PROVIDER) private readonly provider: FootballDataProvider,
    @Inject(FOOTBALL_REFERENCE_REPOSITORY) private readonly reference: FootballReferenceRepository,
    private readonly matches: ApplyProviderMatchUpdate,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly config: AppConfig,
  ) {}

  async run(): Promise<SyncStats> {
    const id = this.ids.next();
    await this.reference.startRun({
      id,
      provider: this.provider.name,
      kind: 'FIXTURES',
      startedAt: this.clock.now(),
    });
    try {
      const stats = await this.sync();
      await this.reference.finishRun(id, this.clock.now(), { stats });
      return stats;
    } catch (error) {
      await this.reference.finishRun(id, this.clock.now(), {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async sync(): Promise<SyncStats> {
    const competitions = new Map<string, CompetitionKeys>();
    for (const competition of await this.provider.listCompetitions()) {
      competitions.set(competition.code, await this.reference.upsertCompetition(competition));
    }

    const now = this.clock.now().getTime();
    const { pastDays, futureDays } = this.config.footballSync;
    const fixtures = await this.provider.listFixtures({
      from: new Date(now - pastDays * DAY),
      to: new Date(now + futureDays * DAY),
    });

    const teams = await this.reference.ensureTeams(
      this.provider.name,
      fixtures.flatMap((fixture): ProviderTeam[] => [fixture.homeTeam, fixture.awayTeam]),
    );
    const stats: SyncStats = { CREATED: 0, UPDATED: 0, UNCHANGED: 0, STALE: 0, REJECTED: 0, squads: 0 };
    for (const fixture of fixtures) {
      stats[await this.applyFixture(fixture, competitions, teams)] += 1;
    }
    stats.squads = await this.syncSquads(fixtures, teams);
    return stats;
  }

  private applyFixture(
    fixture: ProviderMatch,
    competitions: ReadonlyMap<string, CompetitionKeys>,
    teams: ReadonlyMap<string, string>,
  ): Promise<ApplyOutcome> {
    return this.matches.apply({
      ...fixture,
      provider: this.provider.name,
      refs: {
        ...lookup(competitions, fixture.competitionCode),
        homeTeamId: lookup(teams, fixture.homeTeam.ref),
        awayTeamId: lookup(teams, fixture.awayTeam.ref),
        roundLabel: fixture.roundLabel,
      },
    });
  }

  private async syncSquads(fixtures: readonly ProviderMatch[], teams: ReadonlyMap<string, string>): Promise<number> {
    const missing = await this.reference.matchesWithoutSquad(
      this.provider.name,
      fixtures.map((fixture) => fixture.providerMatchId),
    );
    const squads = new Map<string, ProviderSquadPlayer[]>();
    for (const match of missing) {
      squads.set(match.matchId, await this.provider.getSquads(match.providerMatchId));
    }
    const players = await this.reference.ensurePlayers(
      this.provider.name,
      [...squads.values()].flat().map((entry) => entry.player),
    );
    for (const [matchId, squad] of squads) {
      await this.reference.addSquad(
        matchId,
        squad.map((entry) => ({
          playerId: lookup(players, entry.player.ref),
          teamId: lookup(teams, entry.teamRef),
          role: entry.role,
          shirtNumber: entry.shirtNumber,
        })),
      );
    }
    return squads.size;
  }
}
