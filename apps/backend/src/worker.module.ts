import { BullModule } from '@nestjs/bullmq';
import { type DynamicModule, Module } from '@nestjs/common';
import { FootballJobsModule } from '@modules/football';
import { LeaderboardsJobsModule } from '@modules/leaderboards';
import { PointsJobsModule } from '@modules/points';
import { QuestionBankJobsModule } from '@modules/question-bank';
import { AppConfig } from '@shared/infrastructure/config';
import { CoreModule } from '@shared/infrastructure/core.module';
import { OutboxPublisherModule } from '@shared/infrastructure/outbox';

/**
 * Root module of the worker process: outbox publisher, BullMQ processors (`*JobsModule` of each
 * business module) and schedulers. It serves only /health and /metrics over HTTP.
 */
@Module({})
export class WorkerModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: WorkerModule,
      imports: [
        CoreModule.register(config),
        OutboxPublisherModule,
        BullModule.forRootAsync({
          inject: [AppConfig],
          useFactory: (appConfig: AppConfig) => ({ connection: { url: appConfig.redisUrl } }),
        }),
        FootballJobsModule,
        PointsJobsModule,
        LeaderboardsJobsModule,
        QuestionBankJobsModule,
      ],
    };
  }
}
