import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import type { QuestionStatsRepository } from '../application/ports/question-stats-repository';
import type { QuestionStatsIncrement } from '../domain/question-stats';

@Injectable()
export class PrismaQuestionStatsRepository implements QuestionStatsRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {}

  async markBattleAsApplied(battleId: string, at: Date): Promise<boolean> {
    const inserted = await this.txHost.tx.$executeRaw`
      INSERT INTO question_stats_applied (battle_id, applied_at) VALUES (${battleId}::uuid, ${at})
      ON CONFLICT (battle_id) DO NOTHING`;
    return inserted === 1;
  }

  async addToQuestionStats(increments: QuestionStatsIncrement[], at: Date): Promise<void> {
    for (const { questionId, timesServed, timesSolved, wrongAnswers, stepsToSolve } of increments) {
      await this.txHost.tx.$executeRaw`
        INSERT INTO question_stats (question_id, times_served, times_solved, wrong_answers, steps_to_solve_sum, updated_at)
        VALUES (${questionId}::uuid, ${timesServed}, ${timesSolved}, ${wrongAnswers}, ${stepsToSolve}, ${at})
        ON CONFLICT (question_id) DO UPDATE SET
          times_served = question_stats.times_served + EXCLUDED.times_served,
          times_solved = question_stats.times_solved + EXCLUDED.times_solved,
          wrong_answers = question_stats.wrong_answers + EXCLUDED.wrong_answers,
          steps_to_solve_sum = question_stats.steps_to_solve_sum + EXCLUDED.steps_to_solve_sum,
          updated_at = EXCLUDED.updated_at`;
    }
  }
}
