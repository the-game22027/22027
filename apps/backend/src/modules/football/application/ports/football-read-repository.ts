import type {
  CompetitionRecord,
  MatchFilter,
  MatchLockFacts,
  MatchPosition,
  MatchRecord,
  SquadPlayerRecord,
} from '../football-records';

export interface FootballReadRepository {
  listActiveCompetitions(): Promise<CompetitionRecord[]>;
  listMatches(filter: MatchFilter, after: MatchPosition | undefined, take: number): Promise<MatchRecord[]>;
  findMatch(matchId: string): Promise<MatchRecord | null>;
  findLockFacts(matchId: string): Promise<MatchLockFacts | null>;
  listSquad(matchId: string): Promise<SquadPlayerRecord[]>;
}

export const FOOTBALL_READ_REPOSITORY = Symbol('FOOTBALL_READ_REPOSITORY');
