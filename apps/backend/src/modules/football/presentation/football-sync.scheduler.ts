import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { AppConfig } from '@shared/infrastructure/config';
import { QueueProvider } from '@shared/infrastructure/queue/queue-provider';
import { FOOTBALL_SYNC_QUEUE } from './football-sync.processor';

const SCHEDULER_ID = 'football-sync';
const ATTEMPTS = 10;

@Injectable()
export class FootballSyncScheduler implements OnApplicationBootstrap {
  constructor(
    private readonly queues: QueueProvider,
    private readonly config: AppConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queues
      .get(FOOTBALL_SYNC_QUEUE)
      .upsertJobScheduler(
        SCHEDULER_ID,
        { every: this.config.footballSync.intervalSeconds * 1000 },
        { name: 'sync', opts: { attempts: ATTEMPTS } },
      );
  }
}
