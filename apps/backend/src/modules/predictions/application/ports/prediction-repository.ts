import type { ExactScore } from '../../domain/exact-score';

export type PredictionStatus = 'ACTIVE' | 'VOID';

export interface StoredPrediction {
  readonly id: string;
  readonly matchId: string;
  readonly status: PredictionStatus;
  readonly revision: number;
  readonly updatedAt: Date;
  readonly score: ExactScore;
}

/** A prediction with its owner, for the read paths that show other players' predictions. */
export interface OwnedPrediction extends StoredPrediction {
  readonly userId: string;
  readonly createdAt: Date;
}

export interface PredictionKey {
  readonly userId: string;
  readonly matchId: string;
}

export interface PredictionRevisionWrite {
  readonly predictionId: string;
  readonly revisionId: string;
  readonly revision: number;
  readonly score: ExactScore;
  readonly requestId: string | null;
}

export interface PredictionRepository {
  /** Compares against the database clock, and holds a shared lock until commit so kickoff can't move meanwhile. */
  lockMatchIfPredictable(matchId: string): Promise<boolean>;
  findForUpdate(key: PredictionKey): Promise<StoredPrediction | null>;
  insertIfAbsent(id: string, key: PredictionKey): Promise<boolean>;
  saveRevision(write: PredictionRevisionWrite): Promise<void>;
  findOwn(key: PredictionKey): Promise<StoredPrediction | null>;
  /** One match, these players; ordered by user id (keyset `afterUserId`). */
  listPredictionsOfUsersForMatch(
    matchId: string,
    userIds: readonly string[],
    afterUserId: string | null,
    limit: number,
  ): Promise<OwnedPrediction[]>;
  /** Newest first by when the prediction was made (keyset `after`). */
  listPredictionsOfUser(
    userId: string,
    after: { createdAt: Date; id: string } | null,
    limit: number,
  ): Promise<OwnedPrediction[]>;
}

export const PREDICTION_REPOSITORY = Symbol('PREDICTION_REPOSITORY');
