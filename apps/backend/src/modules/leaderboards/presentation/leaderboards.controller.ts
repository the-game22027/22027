import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthContext, CurrentUser } from '@modules/auth';
import { LeaderboardQuery, type PeriodView } from '../application/leaderboard.query';
import {
  LeaderboardCategoryQueryDto,
  LeaderboardPageDto,
  LeaderboardPageQueryDto,
  LeaderboardPathDto,
  LeaderboardPeriodDto,
  LeaderboardPeriodListDto,
  ListPeriodsQueryDto,
  MyRankDto,
} from './dto/leaderboard.dto';

const periodDto = (period: PeriodView): LeaderboardPeriodDto => ({
  kind: period.kind,
  key: period.key,
  startsAt: period.startsAt.toISOString(),
  endsAt: period.endsAt?.toISOString() ?? null,
  status: period.status,
});

@ApiTags('leaderboards')
@ApiBearerAuth()
@Controller({ path: 'leaderboards', version: '1' })
export class LeaderboardsController {
  constructor(private readonly leaderboards: LeaderboardQuery) {}

  @Get('periods')
  periods(@Query() query: ListPeriodsQueryDto): LeaderboardPeriodListDto {
    return { items: this.leaderboards.listRecentPeriods(query.kind).map(periodDto) };
  }

  @Get(':kind/:periodKey')
  async page(
    @CurrentUser() auth: AuthContext,
    @Param() path: LeaderboardPathDto,
    @Query() query: LeaderboardPageQueryDto,
  ): Promise<LeaderboardPageDto> {
    const page = await this.leaderboards.getPage(path.kind, path.periodKey, query.category, auth.userId, {
      ...(query.limit ? { limit: query.limit } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });
    return { period: periodDto(page.period), category: page.board, items: page.items, nextCursor: page.nextCursor };
  }

  @Get(':kind/:periodKey/me')
  myRank(
    @CurrentUser() auth: AuthContext,
    @Param() path: LeaderboardPathDto,
    @Query() query: LeaderboardCategoryQueryDto,
  ): Promise<MyRankDto> {
    return this.leaderboards.getMyRank(path.kind, path.periodKey, query.category, auth.userId);
  }
}
