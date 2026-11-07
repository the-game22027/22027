import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { AppConfig } from '../config';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../persistence';
import { QueueProvider } from '../queue/queue-provider';
import { type OutboxEnvelope, outboxJobId } from './outbox-event';
import { OutboxSubscriptionRegistry } from './outbox-subscriptions';

interface OutboxRow {
  id: string;
  type: string;
  version: number;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
}

/**
 * Worker-only loop that moves committed outbox rows to BullMQ.
 *
 * - `FOR UPDATE SKIP LOCKED` lets several publishers run without claiming the same rows.
 * - `jobId = <eventId>__<subscriber>` makes a second publish of the same event a no-op in BullMQ
 *   (e.g. if Redis accepted the job but the database commit then failed).
 * - Delivery is still at-least-once overall, so every handler must be idempotent.
 */
@Injectable()
export class OutboxPublisher implements OnApplicationBootstrap, OnApplicationShutdown {
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
  ) {}

  onApplicationBootstrap(): void {
    this.schedule(0);
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.running;
  }

  /** Publishes one batch. Returns how many rows were claimed. Exposed for tests. */
  async publishBatch(batchSize = this.config.outbox.batchSize): Promise<number> {
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<OutboxRow[]>`
          SELECT id::text, type, version, aggregate_type, aggregate_id::text, payload, occurred_at
          FROM outbox_events
          WHERE published_at IS NULL
          ORDER BY occurred_at, id
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED`;

        const published: string[] = [];
        for (const row of rows) {
          try {
            await this.enqueue(row);
            published.push(row.id);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.metrics.outboxPublishFailures.inc();
            this.logger.warn({ eventId: row.id, type: row.type, err: message }, 'Outbox publish failed; will retry');
            await tx.$executeRaw`
              UPDATE outbox_events SET attempts = attempts + 1, last_error = ${message.slice(0, 2000)}
              WHERE id = ${row.id}::uuid`;
          }
        }
        if (published.length > 0) {
          await tx.$executeRaw`
            UPDATE outbox_events SET published_at = now(), attempts = attempts + 1
            WHERE id = ANY(${published}::uuid[])`;
          this.metrics.outboxPublished.inc(published.length);
        }
        return rows.length;
      },
      { timeout: 30_000 },
    );
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
    } catch (error) {
      this.logger.error({ err: error }, 'Outbox publisher tick failed');
    }
    // A full batch means there is probably more waiting: continue immediately.
    this.schedule(claimed >= this.config.outbox.batchSize ? 0 : this.config.outbox.pollIntervalMs);
  }
}
