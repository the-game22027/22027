import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppConfig } from '@shared/infrastructure/config';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import { CLOCK, type Clock } from '@shared/kernel';
import type {
  FootballDataProvider,
  ProviderCompetition,
  ProviderMatch,
  ProviderSquadPlayer,
  ProviderTeam,
} from '../../application/ports/football-data-provider';
import { generateFixtures, generateSquad, type PlayerNames, type SeedCompetition } from './mock-fixtures';

const PROVIDER = 'mock';

type SeedCompetitionFile = Omit<ProviderCompetition, 'season'> &
  SeedCompetition & { season: { label: string; startsOn: string; endsOn: string } };

interface Seed {
  readonly competitions: readonly SeedCompetitionFile[];
  readonly teams: ReadonlyMap<string, ProviderTeam>;
  readonly names: PlayerNames;
}

@Injectable()
export class MockFootballProvider implements FootballDataProvider {
  readonly name = PROVIDER;
  private cachedSeed: Seed | undefined;
  private cachedAnchor: Date | undefined;

  constructor(
    private readonly config: AppConfig,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  listCompetitions(): Promise<ProviderCompetition[]> {
    return Promise.resolve(
      this.seed().competitions.map(({ teams: _teams, season, ...competition }) => ({
        ...competition,
        season: { label: season.label, startsOn: new Date(season.startsOn), endsOn: new Date(season.endsOn) },
      })),
    );
  }

  async listFixtures(range: { from: Date; to: Date }): Promise<ProviderMatch[]> {
    return (await this.fixtures()).filter(
      (fixture) => fixture.kickoffAt >= range.from && fixture.kickoffAt <= range.to,
    );
  }

  async getSquads(providerMatchId: string): Promise<ProviderSquadPlayer[]> {
    const fixture = (await this.fixtures()).find((candidate) => candidate.providerMatchId === providerMatchId);
    if (!fixture) throw new Error(`Unknown mock match ${providerMatchId}`);
    return [fixture.homeTeam, fixture.awayTeam].flatMap((team) => generateSquad(team, this.seed().names));
  }

  private async fixtures(): Promise<ProviderMatch[]> {
    const { competitions, teams } = this.seed();
    return generateFixtures(competitions, teams, await this.anchor());
  }

  // The first sync fixes "today" for the schedule. A moving anchor would shift every kickoff on each run.
  private async anchor(): Promise<Date> {
    if (!this.cachedAnchor) {
      const first = await this.txHost.tx.providerSyncRun.findFirst({
        where: { provider: PROVIDER },
        orderBy: { startedAt: 'asc' },
        select: { startedAt: true },
      });
      this.cachedAnchor = first?.startedAt ?? this.clock.now();
    }
    return this.cachedAnchor;
  }

  private seed(): Seed {
    if (!this.cachedSeed) {
      const read = <T>(file: string): T =>
        JSON.parse(readFileSync(join(this.config.footballSync.mockSeedDir, file), 'utf8')) as T;
      this.cachedSeed = {
        competitions: read<SeedCompetitionFile[]>('competitions.json'),
        teams: new Map(read<ProviderTeam[]>('teams.json').map((team) => [team.ref, team])),
        names: read<PlayerNames>('player-names.json'),
      };
    }
    return this.cachedSeed;
  }
}
