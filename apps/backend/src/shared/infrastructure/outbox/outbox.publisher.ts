import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { AppConfig } from '../config';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../persistence';
import { QueueProvider } from '../queue/queue-provider';
import { REDIS_CLIENT } from '../redis';
import { type OutboxEnvelope, outboxJobId } from './outbox-event';
import { outboxRetryDelayMs } from './outbox-retry';
import { OutboxSubscriptionRegistry } from './outbox-subscriptions';

interface OutboxRow {
  id: string;
  type: string;
  version: number;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
  attempts: number;
}

interface BacklogRow {
  unpublished: number;
  dead_lettered: number;
  oldest_age_seconds: number;
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Worker-only loop that moves committed outbox rows to BullMQ.
 *
 * - A short statement claims rows by pushing `available_at` forward (the lease). Nothing is locked while
 *   talking to Redis, and a crashed publisher's rows simply become available again when the lease ends.
 * - Every later write checks `claimed_by`, so a publisher that lost its lease cannot overwrite the new owner.
 * - `jobId = <eventId>__<subscriber>` makes a second publish a no-op in BullMQ while the job is retained.
 * - Delivery is still at-least-once overall, so every handler must be idempotent.
 */
@Injectable()
export class OutboxPublisher implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(OutboxPublisher.name);
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<void> | undefined;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueueProvider,
    private readonly subscriptions: OutboxSubscriptionRegistry,
    private readonly metrics: MetricsService,
    private readonly config: AppConfig,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  onApplicationBootstrap(): void {
    this.schedule(0);
  }

  // Before, not on, shutdown: the database and queue connections close in the later hook.
  async beforeApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.running;
  }

  /** Publishes one batch. Returns how many rows were claimed. Exposed for tests. */
  async publishBatch(batchSize = this.config.outbox.batchSize): Promise<number> {
    if (this.stopped || !(await this.redisIsUp())) return 0;
    await this.deadLetterExhausted();

    const owner = randomUUID();
    const rows = await this.claim(owner, batchSize);
    // Rows not started in time go back, so the last row started still finishes inside the lease.
    const startBy = performance.now() + this.config.outbox.leaseMs / 2;
    const published: string[] = [];
    let next = 0;
    for (; next < rows.length && !this.stopped && performance.now() < startBy; next++) {
      const row = rows[next];
      try {
        await this.enqueueWithTimeout(row);
        published.push(row.id);
      } catch (error) {
        await this.recordFailure(owner, row, errorMessage(error));
      }
    }
    await this.markPublished(owner, published);
    await this.release(owner, rows.slice(next));
    return rows.length;
  }

  /** Refreshes the backlog gauges. Exposed for tests. */
  async reportBacklog(): Promise<void> {
    const [backlog] = await this.prisma.$queryRaw<BacklogRow[]>`
      SELECT count(*) FILTER (WHERE dead_lettered_at IS NULL)::int AS unpublished,
             count(*) FILTER (WHERE dead_lettered_at IS NOT NULL)::int AS dead_lettered,
             COALESCE(EXTRACT(EPOCH FROM now() - min(occurred_at) FILTER (WHERE dead_lettered_at IS NULL)), 0)::float8
               AS oldest_age_seconds
      FROM outbox_events
      WHERE published_at IS NULL`;
    this.metrics.outboxUnpublished.set(backlog.unpublished);
    this.metrics.outboxDeadLettered.set(backlog.dead_lettered);
    this.metrics.outboxOldestUnpublishedAge.set(backlog.oldest_age_seconds);
  }

  // Without this, an outage would use up every event's attempts and dead-letter healthy events.
  private async redisIsUp(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      this.logger.warn({ err: errorMessage(error) }, 'Redis unavailable; outbox publishing paused');
      return false;
    }
  }

  private async deadLetterExhausted(): Promise<void> {
    const rows = await this.prisma.$queryRaw<Pick<OutboxRow, 'id' | 'type' | 'attempts'>[]>`
      UPDATE outbox_events
      SET dead_lettered_at = now(), claimed_by = NULL,
          last_error = COALESCE(last_error, 'Lease expired before the publish finished')
      WHERE published_at IS NULL AND dead_lettered_at IS NULL
        AND available_at <= now() AND attempts >= ${this.config.outbox.maxAttempts}
      RETURNING id::text, type, attempts`;
    for (const row of rows) {
      this.logger.error({ eventId: row.id, type: row.type, attempts: row.attempts }, 'Outbox event dead-lettered');
    }
  }

  private async claim(owner: string, batchSize: number): Promise<OutboxRow[]> {
    const { leaseMs, maxAttempts } = this.config.outbox;
    const rows = await this.prisma.$queryRaw<OutboxRow[]>`
      WITH due AS (
        SELECT id FROM outbox_events
        WHERE published_at IS NULL AND dead_lettered_at IS NULL
          AND available_at <= now() AND attempts < ${maxAttempts}
        ORDER BY available_at, id
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox_events e
      SET attempts = e.attempts + 1, claimed_by = ${owner}::uuid,
          available_at = now() + (${leaseMs}::double precision * interval '1 millisecond')
      FROM due
      WHERE e.id = due.id
      RETURNING e.id::text, e.type, e.version, e.aggregate_type, e.aggregate_id::text, e.payload, e.occurred_at,
                e.attempts`;
    return rows.sort((a, b) => a.occurred_at.getTime() - b.occurred_at.getTime() || a.id.localeCompare(b.id));
  }

  private async enqueueWithTimeout(row: OutboxRow): Promise<void> {
    const timeoutMs = this.config.outbox.publishTimeoutMs;
    const abort = new AbortController();
    const timeout = sleep(timeoutMs, undefined, { signal: abort.signal }).then(() => {
      throw new Error(`Publish timed out after ${String(timeoutMs)} ms`);
    });
    try {
      await Promise.race([this.enqueue(row), timeout]);
    } finally {
      abort.abort();
    }
  }

  private async enqueue(row: OutboxRow): Promise<void> {
    const envelope: OutboxEnvelope = {
      eventId: row.id,
      type: row.type,
      version: row.version,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      occurredAt: row.occurred_at.toISOString(),
      payload: row.payload,
    };
    for (const subscription of this.subscriptions.forEvent(row.type)) {
      await this.queues
        .get(subscription.queue)
        .add(row.type, envelope, { jobId: outboxJobId(row.id, subscription.subscriber) });
    }
  }

  private async recordFailure(owner: string, row: OutboxRow, message: string): Promise<void> {
    const { maxAttempts } = this.config.outbox;
    // An exhausted row is due at once, so the next batch dead-letters it through the one path that does.
    const retryInMs = row.attempts >= maxAttempts ? 0 : outboxRetryDelayMs(row.attempts, this.config.outbox);
    const updated = await this.prisma.$executeRaw`
      UPDATE outbox_events
      SET claimed_by = NULL, last_error = ${message.slice(0, 2000)},
          available_at = now() + (${retryInMs}::double precision * interval '1 millisecond')
      WHERE id = ${row.id}::uuid AND claimed_by = ${owner}::uuid`;
    this.metrics.outboxPublishFailures.inc();
    this.countLostLeases(1, updated);
    this.logger.warn(
      { eventId: row.id, type: row.type, attempts: row.attempts, retryInMs, err: message },
      'Outbox publish failed',
    );
  }

  private async markPublished(owner: string, ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    const updated = await this.prisma.$executeRaw`
      UPDATE outbox_events SET published_at = now(), claimed_by = NULL, last_error = NULL
      WHERE id = ANY(${ids}::uuid[]) AND claimed_by = ${owner}::uuid`;
    this.metrics.outboxPublished.inc(updated);
    this.countLostLeases(ids.length, updated);
  }

  /** Rows never attempted hand their attempt back: stopping or running out of time is not the event's fault. */
  private async release(owner: string, rows: readonly OutboxRow[]): Promise<void> {
    if (rows.length === 0) return;
    const ids = rows.map((row) => row.id);
    await this.prisma.$executeRaw`
      UPDATE outbox_events SET attempts = attempts - 1, claimed_by = NULL, available_at = now()
      WHERE id = ANY(${ids}::uuid[]) AND claimed_by = ${owner}::uuid`;
  }

  private countLostLeases(expected: number, updated: number): void {
    if (updated === expected) return;
    this.metrics.outboxLeasesLost.inc(expected - updated);
    this.logger.warn({ lost: expected - updated }, 'Outbox lease expired before the publish finished');
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.running = this.tick();
    }, delayMs);
  }

  private async tick(): Promise<void> {
    let claimed = 0;
    try {
      claimed = await this.publishBatch();
      await this.reportBacklog();
    } catch (error) {
      this.logger.error({ err: error }, 'Outbox publisher tick failed');
    }
    // A full batch means there is probably more waiting: continue immediately.
    this.schedule(claimed >= this.config.outbox.batchSize ? 0 : this.config.outbox.pollIntervalMs);
  }
}
