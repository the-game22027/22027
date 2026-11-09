import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequestLocale } from '@shared/infrastructure/http/request-locale.decorator';
import type { Locale } from '@shared/kernel';
import { FootballQuery } from '../application/football.query';
import { localizedName } from '../domain/localized-names';
import {
  CompetitionListDto,
  ListMatchesQueryDto,
  MatchDetailDto,
  MatchPageDto,
  SquadListDto,
} from './dto/football.dto';
import { matchSummary } from './football-response';

@ApiTags('football')
@ApiBearerAuth()
@Controller({ version: '1' })
export class FootballController {
  constructor(private readonly football: FootballQuery) {}

  @Get('competitions')
  async competitions(@RequestLocale() locale: Locale): Promise<CompetitionListDto> {
    const competitions = await this.football.listCompetitions();
    return {
      items: competitions.map(({ names, ...competition }) => ({
        ...competition,
        name: localizedName(names, locale),
      })),
    };
  }

  @Get('matches')
  async matches(@Query() query: ListMatchesQueryDto, @RequestLocale() locale: Locale): Promise<MatchPageDto> {
    const page = await this.football.listMatches(
      {
        ...(query.from ? { from: new Date(query.from) } : {}),
        ...(query.to ? { to: new Date(query.to) } : {}),
        ...(query.competitionId ? { competitionId: query.competitionId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      { ...(query.limit ? { limit: query.limit } : {}), ...(query.cursor ? { cursor: query.cursor } : {}) },
    );
    return { items: page.items.map((match) => matchSummary(match, locale)), nextCursor: page.nextCursor };
  }

  @Get('matches/:matchId')
  async match(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @RequestLocale() locale: Locale,
  ): Promise<MatchDetailDto> {
    const match = await this.football.getMatch(matchId);
    return {
      ...matchSummary(match, locale),
      endedAt: match.endedAt?.toISOString() ?? null,
      serverTime: match.serverTime.toISOString(),
    };
  }

  @Get('matches/:matchId/squads')
  async squads(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @RequestLocale() locale: Locale,
  ): Promise<SquadListDto> {
    const squad = await this.football.getSquads(matchId);
    return { items: squad.map(({ names, ...player }) => ({ ...player, name: localizedName(names, locale) })) };
  }
}
