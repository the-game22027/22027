import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { z } from 'zod';
import type { OutboxEnvelope } from '@shared/infrastructure/outbox';
import { UpdateLeaderboards } from '../application/update-leaderboards';

export const LEADERBOARDS_QUEUE = 'leaderboards';

const pointsRecordedPayload = z.object({
  userIds: z.array(z.uuid()),
  categories: z.array(z.string()),
  occurredAtMin: z.iso.datetime(),
  occurredAtMax: z.iso.datetime(),
});

/** Consumes the events the leaderboards module subscribes to (leaderboards-jobs.module.ts). */
@Processor(LEADERBOARDS_QUEUE, { concurrency: 4 })
export class LeaderboardsEventsProcessor extends WorkerHost {
  constructor(private readonly updateLeaderboards: UpdateLeaderboards) {
    super();
  }

  async process(job: Job<OutboxEnvelope>): Promise<void> {
    const { type, payload } = job.data;
    if (type !== 'PointsRecorded') throw new Error(`The leaderboards queue does not handle ${type}`);
    const recorded = pointsRecordedPayload.parse(payload);
    await this.updateLeaderboards.updateLeaderboardsForRecordedPoints({
      ...recorded,
      occurredAtMin: new Date(recorded.occurredAtMin),
      occurredAtMax: new Date(recorded.occurredAtMax),
    });
  }
}
