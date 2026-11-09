import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { FootballIngestionModule } from './football-ingestion.module';
import { FOOTBALL_SYNC_QUEUE, FootballSyncProcessor } from './presentation/football-sync.processor';
import { FootballSyncScheduler } from './presentation/football-sync.scheduler';

@Module({
  imports: [FootballIngestionModule, BullModule.registerQueue({ name: FOOTBALL_SYNC_QUEUE })],
  providers: [FootballSyncProcessor, FootballSyncScheduler],
})
export class FootballJobsModule {}
