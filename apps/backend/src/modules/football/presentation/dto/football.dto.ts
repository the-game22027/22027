import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { MATCH_STATUSES, type MatchStatus } from '../../domain/match-status';

export class ListMatchesQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @IsOptional()
  @IsUUID()
  competitionId?: string;

  @IsOptional()
  @IsIn(MATCH_STATUSES)
  status?: MatchStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;
}

export class CompetitionDto {
  id!: string;
  code!: string;
  name!: string;
  type!: string;
  countryCode!: string | null;
  isNationalTeams!: boolean;
}

export class CompetitionListDto {
  items!: CompetitionDto[];
}

export class TeamDto {
  id!: string;
  name!: string;
  shortName?: string;
  crestUrl!: string | null;
  type!: string;
}

export class MatchCompetitionDto {
  id!: string;
  name!: string;
  code!: string;
}

export class PenaltiesDto {
  home!: number;
  away!: number;
}

export class ScoreDto {
  home!: number;
  away!: number;
  decidedBy?: string;
  penalties?: PenaltiesDto;
}

export class MatchSummaryDto {
  id!: string;
  competition!: MatchCompetitionDto;
  roundLabel!: string | null;
  homeTeam!: TeamDto;
  awayTeam!: TeamDto;
  kickoffAt!: string;
  status!: MatchStatus;
  score!: ScoreDto | null;
  predictable!: boolean;
}

export class MatchPageDto {
  items!: MatchSummaryDto[];
  nextCursor!: string | null;
}

export class MatchDetailDto extends MatchSummaryDto {
  endedAt!: string | null;
  serverTime!: string;
}

export class SquadPlayerDto {
  playerId!: string;
  name!: string;
  teamId!: string;
  role!: string;
  shirtNumber!: number | null;
}

export class SquadListDto {
  items!: SquadPlayerDto[];
}
