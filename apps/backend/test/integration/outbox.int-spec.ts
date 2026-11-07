import { Test, type TestingModule } from '@nestjs/testing';
import { TransactionHost } from '@nestjs-cls/transactional';
import { type Queue, Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { AppConfig } from '../../src/shared/infrastructure/config';
import { MetricsService } from '../../src/shared/infrastructure/metrics/metrics.service';
import {
  type OutboxEnvelope,
  OutboxPublisher,
  OutboxRequiresTransactionError,
  OutboxSubscriptionRegistry,
  OutboxWriter,
} from '../../src/shared/infrastructure/outbox';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { QueueProvider } from '../../src/shared/infrastructure/queue/queue-provider';
import { testConfig } from '../support/test-app';

/**
 * Outbox guarantees (ADR-0004): an event exists iff its transaction commits, and each committed event
 * becomes exactly one job per subscriber even when publishers run concurrently or publish twice.
 */
describe('transactional outbox', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let writer: OutboxWriter;
  let txHost: TransactionHost;
  let registry: OutboxSubscriptionRegistry;
  let queues: QueueProvider;

  // Publishers are constructed by hand so no background loop races the assertions.
  const newPublisher = (): OutboxPublisher =>
    new OutboxPublisher(prisma, queues, registry, moduleRef.get(MetricsService), moduleRef.get(AppConfig));

  const event = (type: string) => ({
    type,
    version: 1,
    aggregateType: 'Sample',
    aggregateId: randomUUID(),
    payload: { hello: 'world' },
  });

  /** Unique queue + event type per test, with the given subscribers registered. */
  const subscribe = (...subscribers: string[]): { type: string; queue: Queue } => {
    const suffix = randomUUID().slice(0, 8);
    const type = `SampleHappened_${suffix}`;
    const queueName = `test-${suffix}`;
    for (const subscriber of subscribers) {
      registry.register({ eventType: type, subscriber, queue: queueName });
    }
    return { type, queue: queues.get(queueName) };
  };

  const jobIds = async (queue: Queue): Promise<string[]> =>
    (await queue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed', 'prioritized']))
      .map((job) => job.id!)
      .sort();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [CoreModule.register(testConfig())] }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    writer = moduleRef.get(OutboxWriter);
    txHost = moduleRef.get(TransactionHost);
    registry = moduleRef.get(OutboxSubscriptionRegistry);
    queues = moduleRef.get(QueueProvider);
  });

  beforeEach(async () => {
    await prisma.outboxEvent.deleteMany();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('refuses to write outside a transaction', async () => {
    await expect(writer.write(event('Anything'))).rejects.toBeInstanceOf(OutboxRequiresTransactionError);
  });

  it('writes nothing and publishes nothing when the transaction rolls back', async () => {
    const { type, queue } = subscribe('sample.one');

    await expect(
      txHost.withTransaction(async () => {
        await writer.write(event(type));
        throw new Error('business failure after the write');
      }),
    ).rejects.toThrow('business failure');

    expect(await prisma.outboxEvent.count()).toBe(0);
    expect(await newPublisher().publishBatch()).toBe(0);
    expect(await jobIds(queue)).toEqual([]);
  });

  it('publishes a committed event exactly once per subscriber, even when published again', async () => {
    const { type, queue } = subscribe('sample.one', 'sample.two');
    const eventId = await txHost.withTransaction(() => writer.write(event(type)));

    expect(await newPublisher().publishBatch()).toBe(1);
    expect(await jobIds(queue)).toEqual([`${eventId}__sample.one`, `${eventId}__sample.two`]);
    expect((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } })).publishedAt).not.toBeNull();

    // Simulate "Redis accepted the jobs but the DB commit failed": the row becomes unpublished again.
    await prisma.outboxEvent.update({ where: { id: eventId }, data: { publishedAt: null } });
    expect(await newPublisher().publishBatch()).toBe(1);
    expect(await jobIds(queue)).toHaveLength(2); // jobId dedup: no duplicates
  });

  it('never double-publishes with two publishers running concurrently (SKIP LOCKED)', async () => {
    const { type, queue } = subscribe('sample.concurrent');
    const total = 60;
    await txHost.withTransaction(async () => {
      for (let i = 0; i < total; i++) await writer.write(event(type));
    });

    const drain = async (publisher: OutboxPublisher): Promise<number> => {
      let claimed = 0;
      for (let batch = await publisher.publishBatch(10); batch > 0; batch = await publisher.publishBatch(10)) {
        claimed += batch;
      }
      return claimed;
    };
    const [a, b] = await Promise.all([drain(newPublisher()), drain(newPublisher())]);

    expect(a + b).toBe(total); // every row claimed by exactly one publisher
    expect(await prisma.outboxEvent.count({ where: { publishedAt: null } })).toBe(0);
    const ids = await jobIds(queue);
    expect(ids).toHaveLength(total);
    expect(new Set(ids).size).toBe(total);
  });

  it('delivers a committed event to a BullMQ handler', async () => {
    const { type, queue } = subscribe('sample.handler');
    const eventId = await txHost.withTransaction(() => writer.write(event(type)));

    let deliver: (envelope: OutboxEnvelope) => void = () => undefined;
    const received = new Promise<OutboxEnvelope>((resolve) => (deliver = resolve));
    // Closing a worker from inside its own processor would wait for itself, so close it afterwards.
    const worker = new Worker<OutboxEnvelope>(queue.name, (job) => Promise.resolve(deliver(job.data)), {
      connection: { url: moduleRef.get(AppConfig).redisUrl },
    });
    try {
      await newPublisher().publishBatch();
      const envelope = await received;
      expect(envelope).toMatchObject({
        eventId,
        type,
        version: 1,
        aggregateType: 'Sample',
        payload: { hello: 'world' },
      });
    } finally {
      await worker.close();
    }
  });
});
