import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CLOCK, type Clock } from '@shared/kernel';
import { listQuestionStatsIncrements, type RoundResultForStats } from '../domain/question-stats';
import { QUESTION_STATS_REPOSITORY, type QuestionStatsRepository } from './ports/question-stats-repository';

/**
 * `BattleCompleted` → `question_stats` (08 §5.7). The battle id is recorded in the same transaction as
 * the increments, so a redelivered event adds nothing.
 */
@Injectable()
export class RecordQuestionStats {
  constructor(
    @Inject(QUESTION_STATS_REPOSITORY) private readonly stats: QuestionStatsRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Returns false when the battle had already been applied. */
  @Transactional()
  async recordQuestionStatsOfBattle(battleId: string, results: readonly RoundResultForStats[]): Promise<boolean> {
    const now = this.clock.now();
    if (!(await this.stats.markBattleAsApplied(battleId, now))) return false;
    await this.stats.addToQuestionStats(listQuestionStatsIncrements(results), now);
    return true;
  }
}
