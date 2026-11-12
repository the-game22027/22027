import { BullModule } from '@nestjs/bullmq';
import { Module, type OnModuleInit } from '@nestjs/common';
import { PointsModule } from '@modules/points';
import { OutboxSubscriptionRegistry } from '@shared/infrastructure/outbox';
import { LEADERBOARD_REPOSITORY } from './application/ports/leaderboard-repository';
import { UpdateLeaderboards } from './application/update-leaderboards';
import { PrismaLeaderboardRepository } from './infrastructure/prisma-leaderboard.repository';
import { leaderboardCalendarProvider } from './leaderboard-calendar.provider';
import { LEADERBOARDS_QUEUE, LeaderboardsEventsProcessor } from './presentation/leaderboards-events.processor';

/** The ledger → board projection (worker only). */
@Module({
  imports: [PointsModule, BullModule.registerQueue({ name: LEADERBOARDS_QUEUE })],
  providers: [
    UpdateLeaderboards,
    LeaderboardsEventsProcessor,
    leaderboardCalendarProvider,
    { provide: LEADERBOARD_REPOSITORY, useClass: PrismaLeaderboardRepository },
  ],
  exports: [UpdateLeaderboards],
})
export class LeaderboardsJobsModule implements OnModuleInit {
  constructor(private readonly subscriptions: OutboxSubscriptionRegistry) {}

  onModuleInit(): void {
    this.subscriptions.register({
      eventType: 'PointsRecorded',
      subscriber: 'leaderboards.update-boards',
      queue: LEADERBOARDS_QUEUE,
    });
  }
}
