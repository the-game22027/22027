import type { ProviderCompetition, ProviderPlayer, ProviderTeam } from './football-data-provider';

export interface CompetitionKeys {
  readonly competitionId: string;
  readonly seasonId: string;
}

export interface MissingSquad {
  readonly matchId: string;
  readonly providerMatchId: string;
}

export interface SquadEntry {
  readonly playerId: string;
  readonly teamId: string;
  readonly role: string;
  readonly shirtNumber: number | null;
}

export interface FootballReferenceRepository {
  upsertCompetition(competition: ProviderCompetition): Promise<CompetitionKeys>;
  ensureTeams(provider: string, teams: readonly ProviderTeam[]): Promise<ReadonlyMap<string, string>>;
  ensurePlayers(provider: string, players: readonly ProviderPlayer[]): Promise<ReadonlyMap<string, string>>;
  matchesWithoutSquad(provider: string, providerMatchIds: readonly string[]): Promise<MissingSquad[]>;
  addSquad(matchId: string, entries: readonly SquadEntry[]): Promise<void>;
  startRun(run: { id: string; provider: string; kind: string; startedAt: Date }): Promise<void>;
  finishRun(id: string, finishedAt: Date, result: { stats: object } | { error: string }): Promise<void>;
}

export const FOOTBALL_REFERENCE_REPOSITORY = Symbol('FOOTBALL_REFERENCE_REPOSITORY');
