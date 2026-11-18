import type { ExactScore } from '../domain/exact-score';
import { outcomeOf } from '../domain/exact-score';
import type { PredictionPickDto } from './dto/prediction.dto';

/** The stored exact score, plus the result it implies (DEC-03: only the score is entered). */
export const picksOf = (score: ExactScore): PredictionPickDto[] => [
  { type: 'EXACT_SCORE', ...score },
  { type: 'RESULT', outcome: outcomeOf(score) },
];
