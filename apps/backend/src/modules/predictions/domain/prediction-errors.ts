import { DomainError } from '@shared/kernel';

export class InvalidPicksError extends DomainError {
  readonly code = 'PREDICTION_INVALID_PICKS';
  readonly kind = 'UNPROCESSABLE';

  constructor(message: string) {
    super(message);
  }
}

export class PredictionLockedError extends DomainError {
  readonly code = 'PREDICTION_LOCKED';
  readonly kind = 'CONFLICT';

  constructor() {
    super('Predictions for this match closed at kickoff.');
  }
}

export class MatchNotPredictableError extends DomainError {
  readonly code = 'MATCH_NOT_PREDICTABLE';
  readonly kind = 'CONFLICT';

  constructor() {
    super('This match is not open for predictions.');
  }
}

export class PredictionNotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly kind = 'NOT_FOUND';

  constructor() {
    super('Prediction not found.');
  }
}
