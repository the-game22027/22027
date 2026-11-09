import type { Locale } from '@shared/kernel';
import type { MatchView, TeamRecord } from '../application/football-records';
import { localizedName } from '../domain/localized-names';
import type { MatchSummaryDto, ScoreDto, TeamDto } from './dto/football.dto';

function teamDto(team: TeamRecord, locale: Locale): TeamDto {
  return {
    id: team.id,
    name: localizedName(team.names, locale),
    ...(team.shortName ? { shortName: team.shortName } : {}),
    crestUrl: team.crestUrl,
    type: team.type,
  };
}

function scoreDto(match: MatchView): ScoreDto | null {
  if (match.homeScore === null || match.awayScore === null) return null;
  return {
    home: match.homeScore,
    away: match.awayScore,
    ...(match.decidedBy ? { decidedBy: match.decidedBy } : {}),
    ...(match.homePenalties !== null && match.awayPenalties !== null
      ? { penalties: { home: match.homePenalties, away: match.awayPenalties } }
      : {}),
  };
}

export function matchSummary(match: MatchView, locale: Locale): MatchSummaryDto {
  return {
    id: match.id,
    competition: {
      id: match.competition.id,
      name: localizedName(match.competition.names, locale),
      code: match.competition.code,
    },
    roundLabel: match.roundLabel,
    homeTeam: teamDto(match.homeTeam, locale),
    awayTeam: teamDto(match.awayTeam, locale),
    kickoffAt: match.kickoffAt.toISOString(),
    status: match.status,
    score: scoreDto(match),
    predictable: match.predictable,
  };
}
