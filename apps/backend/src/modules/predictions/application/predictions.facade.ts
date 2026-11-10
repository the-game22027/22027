import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';
import { FootballQuery } from '@modules/football';
import { AppConfig } from '@shared/infrastructure/config';
import { ID_GENERATOR, type IdGenerator } from '@shared/kernel';
import { type ExactScore, exactScoreFrom, sameScore, type SubmittedPick } from '../domain/exact-score';
import { MatchNotPredictableError, PredictionLockedError } from '../domain/prediction-errors';
import {
  PREDICTION_REPOSITORY,
  type PredictionKey,
  type PredictionRepository,
  type StoredPrediction,
} from './ports/prediction-repository';

const CLOSED_BEFORE_PLAY = new Set(['POSTPONED', 'CANCELLED', 'ABANDONED']);

@Injectable()
export class PredictionsFacade {
  constructor(
    @Inject(PREDICTION_REPOSITORY) private readonly predictions: PredictionRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly football: FootballQuery,
    private readonly config: AppConfig,
    private readonly cls: ClsService,
  ) {}

  @Transactional()
  async submit(key: PredictionKey, picks: readonly SubmittedPick[]): Promise<StoredPrediction> {
    const score = exactScoreFrom(picks, this.config.predictions.maxGoals);
    if (!(await this.predictions.lockMatchIfPredictable(key.matchId))) await this.refuse(key.matchId);

    const existing = await this.predictions.findForUpdate(key);
    if (existing) return this.edit(key, existing, score);

    const id = this.ids.next();
    if (await this.predictions.insertIfAbsent(id, key)) {
      await this.saveRevision(id, 1, score);
      return this.load(key);
    }
    return this.edit(key, await this.load(key, true), score);
  }

  private async edit(key: PredictionKey, current: StoredPrediction, score: ExactScore): Promise<StoredPrediction> {
    if (sameScore(current.score, score)) return current;
    await this.saveRevision(current.id, current.revision + 1, score);
    return this.load(key);
  }

  private saveRevision(predictionId: string, revision: number, score: ExactScore): Promise<void> {
    return this.predictions.saveRevision({
      predictionId,
      revisionId: this.ids.next(),
      revision,
      score,
      requestId: this.cls.getId() ?? null,
    });
  }

  private async load(key: PredictionKey, forUpdate = false): Promise<StoredPrediction> {
    const prediction = await (forUpdate ? this.predictions.findForUpdate(key) : this.predictions.findOwn(key));
    if (!prediction) throw new Error(`Prediction of ${key.userId} for ${key.matchId} cannot be found`);
    return prediction;
  }

  private async refuse(matchId: string): Promise<never> {
    const { status } = await this.football.getLockInfo(matchId);
    throw CLOSED_BEFORE_PLAY.has(status) ? new MatchNotPredictableError() : new PredictionLockedError();
  }
}
