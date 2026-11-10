import { Module } from '@nestjs/common';
import { FootballModule } from '@modules/football';
import { PREDICTION_REPOSITORY } from './application/ports/prediction-repository';
import { PredictionQuery } from './application/prediction.query';
import { PredictionsFacade } from './application/predictions.facade';
import { PrismaPredictionRepository } from './infrastructure/prisma-prediction.repository';

@Module({
  imports: [FootballModule],
  providers: [
    PredictionsFacade,
    PredictionQuery,
    { provide: PREDICTION_REPOSITORY, useClass: PrismaPredictionRepository },
  ],
  exports: [PredictionsFacade, PredictionQuery],
})
export class PredictionsModule {}
