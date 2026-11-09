import type { IncomingMatch } from '../../domain/match-lifecycle';
import type { LocalizedNames } from '../../domain/localized-names';

export interface ProviderCompetition {
  readonly code: string;
  readonly names: LocalizedNames;
  readonly type: string;
  readonly countryCode: string | null;
  readonly isNationalTeams: boolean;
  readonly season: { readonly label: string; readonly startsOn: Date; readonly endsOn: Date };
}

export interface ProviderTeam {
  readonly ref: string;
  readonly names: LocalizedNames;
  readonly shortName: string | null;
  readonly type: string;
  readonly countryCode: string | null;
}

export interface ProviderMatch extends IncomingMatch {
  readonly providerMatchId: string;
  readonly competitionCode: string;
  readonly roundLabel: string | null;
  readonly homeTeam: ProviderTeam;
  readonly awayTeam: ProviderTeam;
}

export interface ProviderPlayer {
  readonly ref: string;
  readonly names: LocalizedNames;
  readonly position: string | null;
  readonly nationalityCode: string | null;
}

export interface ProviderSquadPlayer {
  readonly player: ProviderPlayer;
  readonly teamRef: string;
  readonly role: 'STARTER' | 'SUBSTITUTE';
  readonly shirtNumber: number | null;
}

export interface FootballDataProvider {
  readonly name: string;
  listCompetitions(): Promise<ProviderCompetition[]>;
  listFixtures(range: { readonly from: Date; readonly to: Date }): Promise<ProviderMatch[]>;
  getSquads(providerMatchId: string): Promise<ProviderSquadPlayer[]>;
}

export const FOOTBALL_DATA_PROVIDER = Symbol('FOOTBALL_DATA_PROVIDER');
