import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { z } from 'zod';
import type { OutboxEnvelope } from '@shared/infrastructure/outbox';
import { RecordQuestionStats } from '../application/record-question-stats';

export const QUESTION_BANK_QUEUE = 'question-bank';

// The event belongs to battles; question-bank reads only the round summaries (08 §5.7).
const battleCompletedPayload = z.object({
  battleId: z.uuid(),
  questionResults: z.array(
    z.object({
      questionId: z.uuid(),
      served: z.boolean(),
      solved: z.boolean(),
      wrongAnswers: z.number().int().min(0),
      stepsRevealed: z.number().int().min(0).nullable(),
    }),
  ),
});

/** Consumes the events the question-bank module subscribes to (question-bank-jobs.module.ts). */
@Processor(QUESTION_BANK_QUEUE)
export class QuestionBankEventsProcessor extends WorkerHost {
  constructor(private readonly recordQuestionStats: RecordQuestionStats) {
    super();
  }

  async process(job: Job<OutboxEnvelope>): Promise<{ applied: boolean }> {
    const { type, payload } = job.data;
    if (type !== 'BattleCompleted') throw new Error(`The question-bank queue does not handle ${type}`);
    const { battleId, questionResults } = battleCompletedPayload.parse(payload);
    return { applied: await this.recordQuestionStats.recordQuestionStatsOfBattle(battleId, questionResults) };
  }
}
