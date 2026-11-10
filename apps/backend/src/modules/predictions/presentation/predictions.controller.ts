import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthContext, CurrentUser } from '@modules/auth';
import type { StoredPrediction } from '../application/ports/prediction-repository';
import { PredictionQuery } from '../application/prediction.query';
import { PredictionsFacade } from '../application/predictions.facade';
import { outcomeOf } from '../domain/exact-score';
import { PredictionDto, SubmitPredictionDto } from './dto/prediction.dto';

const toDto = (prediction: StoredPrediction, locked: boolean): PredictionDto => ({
  id: prediction.id,
  matchId: prediction.matchId,
  picks: [
    { type: 'EXACT_SCORE', ...prediction.score },
    { type: 'RESULT', outcome: outcomeOf(prediction.score) },
  ],
  revision: prediction.revision,
  status: prediction.status,
  updatedAt: prediction.updatedAt.toISOString(),
  locked,
});

@ApiTags('predictions')
@ApiBearerAuth()
@Controller({ path: 'matches/:matchId/prediction', version: '1' })
export class PredictionsController {
  constructor(
    private readonly predictions: PredictionsFacade,
    private readonly query: PredictionQuery,
  ) {}

  @Put()
  async submit(
    @CurrentUser() auth: AuthContext,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() body: SubmitPredictionDto,
  ): Promise<PredictionDto> {
    return toDto(await this.predictions.submit({ userId: auth.userId, matchId }, body.picks), false);
  }

  @Get()
  async getOwn(
    @CurrentUser() auth: AuthContext,
    @Param('matchId', ParseUUIDPipe) matchId: string,
  ): Promise<PredictionDto> {
    const { prediction, locked } = await this.query.getOwn({ userId: auth.userId, matchId });
    return toDto(prediction, locked);
  }
}
