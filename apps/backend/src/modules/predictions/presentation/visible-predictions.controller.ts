import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthContext, CurrentUser } from '@modules/auth';
import type { OwnedPrediction } from '../application/ports/prediction-repository';
import { VisiblePredictionsQuery } from '../application/visible-predictions.query';
import {
  FriendPredictionPageDto,
  PredictionPageQueryDto,
  VisiblePredictionDto,
  VisiblePredictionPageDto,
} from './dto/prediction.dto';
import { picksOf } from './prediction-picks';

const pageOf = (query: PredictionPageQueryDto) => ({
  ...(query.limit ? { limit: query.limit } : {}),
  ...(query.cursor ? { cursor: query.cursor } : {}),
});

const toVisibleDto = (prediction: OwnedPrediction): VisiblePredictionDto => ({
  matchId: prediction.matchId,
  picks: picksOf(prediction.score),
  status: prediction.status,
  updatedAt: prediction.updatedAt.toISOString(),
  score: null,
});

/** Other players' predictions (03 §7.1): friends only, after kickoff by the database clock (DEC-21). */
@ApiTags('predictions')
@ApiBearerAuth()
@Controller({ version: '1' })
export class VisiblePredictionsController {
  constructor(private readonly visible: VisiblePredictionsQuery) {}

  @Get('matches/:matchId/predictions/friends')
  async friendsForMatch(
    @CurrentUser() auth: AuthContext,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Query() query: PredictionPageQueryDto,
  ): Promise<FriendPredictionPageDto> {
    const page = await this.visible.listFriendPredictionsForMatch(auth.userId, matchId, pageOf(query));
    return {
      items: page.items.map(({ user, prediction }) => ({
        user,
        picks: picksOf(prediction.score),
        status: prediction.status,
        score: null,
      })),
      nextCursor: page.nextCursor,
    };
  }

  /** A page can hold fewer than `limit`: predictions before kickoff are skipped, the cursor stays exact. */
  @Get('users/:userId/predictions')
  async ofUser(
    @CurrentUser() auth: AuthContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: PredictionPageQueryDto,
  ): Promise<VisiblePredictionPageDto> {
    const page = await this.visible.listVisiblePredictionsOfUser(auth.userId, userId, pageOf(query));
    return { items: page.items.map(toVisibleDto), nextCursor: page.nextCursor };
  }
}
