import type { LocalizedNames } from '../domain/localized-names';
import type { MatchStatus } from '../domain/match-status';

export interface CompetitionRecord {
  readonly id: string;
  readonly code: string;
  readonly names: LocalizedNames;
  readonly type: string;
  readonly countryCode: string | null;
  readonly isNationalTeams: boolean;
}

export interface TeamRecord {
  readonly id: string;
  readonly names: LocalizedNames;
  readonly shortName: string | null;
  readonly crestUrl: string | null;
  readonly type: string;
}

export interface MatchRecord {
  readonly id: string;
  readonly competition: Pick<CompetitionRecord, 'id' | 'code' | 'names'>;
  readonly roundLabel: string | null;
  readonly homeTeam: TeamRecord;
  readonly awayTeam: TeamRecord;
  readonly kickoffAt: Date;
  readonly status: MatchStatus;
  readonly endedAt: Date | null;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly decidedBy: string | null;
  readonly homePenalties: number | null;
  readonly awayPenalties: number | null;
}

export interface MatchView extends MatchRecord {
  readonly predictable: boolean;
}

export interface SquadPlayerRecord {
  readonly playerId: string;
  readonly names: LocalizedNames;
  readonly teamId: string;
  readonly role: string;
  readonly shirtNumber: number | null;
}

export interface MatchFilter {
  readonly from?: Date;
  readonly to?: Date;
  readonly competitionId?: string;
  readonly status?: MatchStatus;
}

export interface MatchPosition {
  readonly kickoffAt: Date;
  readonly id: string;
}

export interface MatchLockInfo {
  readonly status: MatchStatus;
  readonly kickoffAt: Date;
  readonly predictable: boolean;
}
