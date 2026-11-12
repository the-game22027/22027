import { Module } from '@nestjs/common';
import { FootballModule } from '@modules/football';
import { SocialModule } from '@modules/social';
import { UsersModule } from '@modules/users';
import { PREDICTION_REPOSITORY } from './application/ports/prediction-repository';
import { PredictionQuery } from './application/prediction.query';
import { PredictionsFacade } from './application/predictions.facade';
import { VisiblePredictionsQuery } from './application/visible-predictions.query';
import { PrismaPredictionRepository } from './infrastructure/prisma-prediction.repository';
import { PredictionsController } from './presentation/predictions.controller';
import { VisiblePredictionsController } from './presentation/visible-predictions.controller';

@Module({
  imports: [FootballModule, SocialModule, UsersModule],
  controllers: [PredictionsController, VisiblePredictionsController],
  providers: [
    PredictionsFacade,
    PredictionQuery,
    VisiblePredictionsQuery,
    { provide: PREDICTION_REPOSITORY, useClass: PrismaPredictionRepository },
  ],
  exports: [PredictionsFacade, PredictionQuery],
})
export class PredictionsModule {}
