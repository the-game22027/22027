import { Processor, WorkerHost } from '@nestjs/bullmq';
import { FootballSyncService, type SyncStats } from '../application/football-sync.service';

export const FOOTBALL_SYNC_QUEUE = 'football-sync';

@Processor(FOOTBALL_SYNC_QUEUE, { concurrency: 1 })
export class FootballSyncProcessor extends WorkerHost {
  constructor(private readonly sync: FootballSyncService) {
    super();
  }

  process(): Promise<SyncStats> {
    return this.sync.run();
  }
}
