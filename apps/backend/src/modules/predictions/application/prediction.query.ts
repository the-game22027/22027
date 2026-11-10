import { Inject, Injectable } from '@nestjs/common';
import { FootballQuery } from '@modules/football';
import { PredictionNotFoundError } from '../domain/prediction-errors';
import {
  PREDICTION_REPOSITORY,
  type PredictionKey,
  type PredictionRepository,
  type StoredPrediction,
} from './ports/prediction-repository';

export interface OwnPrediction {
  readonly prediction: StoredPrediction;
  readonly locked: boolean;
}

@Injectable()
export class PredictionQuery {
  constructor(
    @Inject(PREDICTION_REPOSITORY) private readonly predictions: PredictionRepository,
    private readonly football: FootballQuery,
  ) {}

  async getOwn(key: PredictionKey): Promise<OwnPrediction> {
    const prediction = await this.predictions.findOwn(key);
    if (!prediction) throw new PredictionNotFoundError();
    const { predictable } = await this.football.getLockInfo(key.matchId);
    return { prediction, locked: !predictable };
  }
}
