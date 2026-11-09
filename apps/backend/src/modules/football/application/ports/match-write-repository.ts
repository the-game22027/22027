import type { CurrentMatch, MatchFacts } from '../../domain/match-lifecycle';

export interface StoredMatch extends CurrentMatch {
  readonly id: string;
}

export interface MatchRefs {
  readonly competitionId: string;
  readonly seasonId: string;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly roundLabel: string | null;
}

export type MatchState = MatchFacts & { readonly resultVersion: number };

export interface NewMatch extends MatchRefs {
  readonly id: string;
  readonly provider: string;
  readonly providerMatchId: string;
  readonly providerUpdatedAt: Date;
  readonly state: MatchState;
}

export interface MatchWriteRepository {
  /** Locks the row, so a prediction checking this match's kickoff waits for the update. */
  findForUpdate(provider: string, providerMatchId: string): Promise<StoredMatch | null>;
  insertIfAbsent(match: NewMatch): Promise<boolean>;
  update(matchId: string, state: MatchState, providerUpdatedAt: Date, changed: boolean): Promise<void>;
}

export const MATCH_WRITE_REPOSITORY = Symbol('MATCH_WRITE_REPOSITORY');
