import type { DefaultJobOptions } from 'bullmq';

/** BullMQ defaults from docs/architecture/05-background-jobs.md §4. Queues may override per job. */
export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000, jitter: 0.5 },
  // Completed jobs are kept 24h so a re-published outbox event with the same jobId is still deduplicated.
  removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
  // Failed jobs are the dead-letter store: kept 14 days, visible in Bull Board.
  removeOnFail: { age: 14 * 24 * 60 * 60 },
};
