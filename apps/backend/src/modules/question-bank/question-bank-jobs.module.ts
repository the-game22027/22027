import { BullModule } from '@nestjs/bullmq';
import { Module, type OnModuleInit } from '@nestjs/common';
import { OutboxSubscriptionRegistry } from '@shared/infrastructure/outbox';
import { QUESTION_STATS_REPOSITORY } from './application/ports/question-stats-repository';
import { RecordQuestionStats } from './application/record-question-stats';
import { PrismaQuestionStatsRepository } from './infrastructure/prisma-question-stats.repository';
import { QUESTION_BANK_QUEUE, QuestionBankEventsProcessor } from './presentation/question-bank-events.processor';

/** Question stats from finished battles (worker only). */
@Module({
  imports: [BullModule.registerQueue({ name: QUESTION_BANK_QUEUE })],
  providers: [
    RecordQuestionStats,
    QuestionBankEventsProcessor,
    { provide: QUESTION_STATS_REPOSITORY, useClass: PrismaQuestionStatsRepository },
  ],
  exports: [RecordQuestionStats],
})
export class QuestionBankJobsModule implements OnModuleInit {
  constructor(private readonly subscriptions: OutboxSubscriptionRegistry) {}

  onModuleInit(): void {
    this.subscriptions.register({
      eventType: 'BattleCompleted',
      subscriber: 'question-bank.update-question-stats',
      queue: QUESTION_BANK_QUEUE,
    });
  }
}
