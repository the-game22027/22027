import type { QuestionStatsIncrement } from '../../domain/question-stats';

export const QUESTION_STATS_REPOSITORY = Symbol('QUESTION_STATS_REPOSITORY');

export interface QuestionStatsRepository {
  /** false when this battle was already applied (a redelivered event). */
  markBattleAsApplied(battleId: string, at: Date): Promise<boolean>;
  addToQuestionStats(increments: QuestionStatsIncrement[], at: Date): Promise<void>;
}
