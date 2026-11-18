import { BullModule } from '@nestjs/bullmq';
import { Module, type OnModuleInit } from '@nestjs/common';
import { OutboxSubscriptionRegistry } from '@shared/infrastructure/outbox';
import { POINT_LEDGER_REPOSITORY } from './application/ports/point-ledger-repository';
import { RecordBattlePoints } from './application/record-battle-points';
import { PrismaPointLedgerRepository } from './infrastructure/prisma-point-ledger.repository';
import { POINTS_QUEUE, PointsEventsProcessor } from './presentation/points-events.processor';

/** Ledger handlers (worker only). */
@Module({
  imports: [BullModule.registerQueue({ name: POINTS_QUEUE })],
  providers: [
    RecordBattlePoints,
    PointsEventsProcessor,
    { provide: POINT_LEDGER_REPOSITORY, useClass: PrismaPointLedgerRepository },
  ],
  exports: [RecordBattlePoints],
})
export class PointsJobsModule implements OnModuleInit {
  constructor(private readonly subscriptions: OutboxSubscriptionRegistry) {}

  onModuleInit(): void {
    this.subscriptions.register({
      eventType: 'BattleCompleted',
      subscriber: 'points.record-battle-points',
      queue: POINTS_QUEUE,
    });
  }
}
