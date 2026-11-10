import { Test, type TestingModule } from '@nestjs/testing';
import { TransactionHost } from '@nestjs-cls/transactional';
import { type Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
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
import { REDIS_CLIENT } from '../../src/shared/infrastructure/redis';
import { testConfig } from '../support/test-app';

/**
 * Outbox guarantees (ADR-0004): an event exists iff its transaction commits, and each committed event
 * becomes exactly one job per subscriber even when publishers run concurrently, crash or publish twice.
 */
describe('transactional outbox', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let writer: OutboxWriter;
  let txHost: TransactionHost;
  let registry: OutboxSubscriptionRegistry;
  let queues: QueueProvider;
  let redis: Redis;
  let metrics: MetricsService;

  type Add = (name: string, data: OutboxEnvelope, options: { jobId: string }) => Promise<unknown>;

  // Publishers are constructed by hand so no background loop races the assertions.
  const newPublisher = (options: { add?: Add; env?: Record<string, string>; redis?: Redis } = {}): OutboxPublisher =>
    new OutboxPublisher(
      prisma,
      options.add ? ({ get: () => ({ add: options.add }) } as unknown as QueueProvider) : queues,
      registry,
      metrics,
      options.env ? testConfig(options.env) : moduleRef.get(AppConfig),
      options.redis ?? redis,
    );

  const failing: Add = () => Promise.reject(new Error('queue refused'));
  const stored = (id: string) => prisma.outboxEvent.findUniqueOrThrow({ where: { id } });
  const write = (type: string) => txHost.withTransaction(() => writer.write(event(type)));
  const makeDue = (id: string) => prisma.outboxEvent.update({ where: { id }, data: { availableAt: new Date(0) } });
  const gauge = async (metric: { get: () => Promise<{ values: { value: number }[] }> }) =>
    (await metric.get()).values[0].value;

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
    redis = moduleRef.get(REDIS_CLIENT);
    metrics = moduleRef.get(MetricsService);
    while (redis.status !== 'ready') await sleep(10);
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

    // Simulate "Redis accepted the jobs but the DB commit failed": the row is unpublished and its lease ends.
    await prisma.outboxEvent.update({ where: { id: eventId }, data: { publishedAt: null, availableAt: new Date(0) } });
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
    expect(await prisma.outboxEvent.count({ where: { attempts: { not: 1 } } })).toBe(0);
    const ids = await jobIds(queue);
    expect(ids).toHaveLength(total);
    expect(new Set(ids).size).toBe(total);
  });

  describe('claiming', () => {
    it('counts one attempt for a publish that succeeds', async () => {
      const { type } = subscribe('sample.attempts');
      const id = await write(type);

      await newPublisher().publishBatch();

      expect(await stored(id)).toMatchObject({ attempts: 1, claimedBy: null, lastError: null });
    });

    it('holds no database lock while talking to the queue', async () => {
      const { type } = subscribe('sample.no-lock');
      const id = await write(type);
      let duringPublish: Awaited<ReturnType<typeof stored>> | undefined;

      await newPublisher({
        add: async () => {
          await prisma.$queryRaw`SELECT id FROM outbox_events WHERE id = ${id}::uuid FOR UPDATE NOWAIT`;
          duringPublish = await stored(id);
        },
      }).publishBatch();

      expect(duringPublish).toMatchObject({ attempts: 1, publishedAt: null });
      expect(duringPublish?.claimedBy).not.toBeNull();
      expect((await stored(id)).publishedAt).not.toBeNull();
    });

    it('leaves an event alone while another publisher holds its lease', async () => {
      const { type } = subscribe('sample.leased');
      const id = await write(type);
      await prisma.outboxEvent.update({
        where: { id },
        data: { claimedBy: randomUUID(), attempts: 1, availableAt: new Date(Date.now() + 60_000) },
      });

      expect(await newPublisher().publishBatch()).toBe(0);
    });

    it('takes over from a publisher that crashed, without a duplicate job', async () => {
      const { type, queue } = subscribe('sample.crash');
      const id = await write(type);
      await newPublisher().publishBatch();
      await prisma.outboxEvent.update({
        where: { id },
        data: { publishedAt: null, claimedBy: randomUUID(), attempts: 1, availableAt: new Date(0) },
      });

      expect(await newPublisher().publishBatch()).toBe(1);

      expect(await stored(id)).toMatchObject({ attempts: 2, claimedBy: null });
      expect(await jobIds(queue)).toHaveLength(1);
    });

    it('cannot finish an event after losing its lease', async () => {
      const { type } = subscribe('sample.fenced');
      const id = await write(type);
      const newOwner = randomUUID();
      const lostBefore = await gauge(metrics.outboxLeasesLost);

      await newPublisher({
        add: async () => {
          await prisma.outboxEvent.update({ where: { id }, data: { claimedBy: newOwner } });
        },
      }).publishBatch();

      expect(await stored(id)).toMatchObject({ publishedAt: null, claimedBy: newOwner });
      expect(await gauge(metrics.outboxLeasesLost)).toBe(lostBefore + 1);
    });
  });

  describe('retrying', () => {
    it('waits before retrying, then publishes and clears the error', async () => {
      const { type, queue } = subscribe('sample.retry');
      const id = await write(type);

      expect(await newPublisher({ add: failing }).publishBatch()).toBe(1);

      const failed = await stored(id);
      expect(failed).toMatchObject({ attempts: 1, publishedAt: null, claimedBy: null, lastError: 'queue refused' });
      expect(failed.availableAt.getTime()).toBeGreaterThan(Date.now());
      expect(await newPublisher().publishBatch()).toBe(0);

      await makeDue(id);
      expect(await newPublisher().publishBatch()).toBe(1);
      expect(await stored(id)).toMatchObject({ attempts: 2, lastError: null });
      expect(await jobIds(queue)).toEqual([`${id}__sample.retry`]);
    });

    it('creates no duplicate when only one of two subscribers failed', async () => {
      const { type, queue } = subscribe('sample.partial-one', 'sample.partial-two');
      const id = await write(type);
      const real = queue.add.bind(queue) as Add;

      await newPublisher({
        add: (name, data, options) =>
          options.jobId.endsWith('two') ? Promise.reject(new Error('second failed')) : real(name, data, options),
      }).publishBatch();
      expect(await jobIds(queue)).toEqual([`${id}__sample.partial-one`]);

      await makeDue(id);
      await newPublisher().publishBatch();
      expect(await jobIds(queue)).toEqual([`${id}__sample.partial-one`, `${id}__sample.partial-two`]);
    });

    it('fails a publish that hangs instead of waiting forever', async () => {
      const { type } = subscribe('sample.hang');
      const id = await write(type);

      await newPublisher({
        add: () => new Promise(() => undefined),
        env: { OUTBOX_PUBLISH_TIMEOUT_MS: '30' },
      }).publishBatch();

      expect(await stored(id)).toMatchObject({ attempts: 1, lastError: 'Publish timed out after 30 ms' });
    });

    it('spends no attempts while Redis is down', async () => {
      const { type } = subscribe('sample.outage');
      const id = await write(type);
      let published = 0;

      const claimed = await newPublisher({
        add: () => Promise.resolve(published++),
        redis: { ping: () => Promise.reject(new Error('connection refused')) } as unknown as Redis,
      }).publishBatch();

      expect(claimed).toBe(0);
      expect(published).toBe(0);
      expect(await stored(id)).toMatchObject({ attempts: 0, claimedBy: null });
    });
  });

  describe('dead letters', () => {
    const twoAttempts = { OUTBOX_MAX_ATTEMPTS: '2' };

    it('stops retrying after the configured attempts and keeps the error', async () => {
      const { type } = subscribe('sample.dead');
      const id = await write(type);
      let calls = 0;
      const publisher = newPublisher({
        env: twoAttempts,
        add: () => {
          calls++;
          return failing('', {} as OutboxEnvelope, { jobId: '' });
        },
      });

      await publisher.publishBatch();
      await makeDue(id);
      await publisher.publishBatch();
      expect(await publisher.publishBatch()).toBe(0);

      expect(calls).toBe(2);
      const dead = await stored(id);
      expect(dead).toMatchObject({ attempts: 2, publishedAt: null, claimedBy: null, lastError: 'queue refused' });
      expect(dead.deadLetteredAt).not.toBeNull();
      await makeDue(id);
      expect(await publisher.publishBatch()).toBe(0);
      expect(calls).toBe(2);
    });

    it('dead-letters an event that keeps crashing its publisher', async () => {
      const { type } = subscribe('sample.crash-loop');
      const id = await write(type);
      await prisma.outboxEvent.update({
        where: { id },
        data: { attempts: 2, claimedBy: randomUUID(), availableAt: new Date(0) },
      });

      expect(await newPublisher({ env: twoAttempts }).publishBatch()).toBe(0);

      const dead = await stored(id);
      expect(dead.deadLetteredAt).not.toBeNull();
      expect(dead).toMatchObject({ claimedBy: null, lastError: 'Lease expired before the publish finished' });
    });

    it('publishes a dead letter again once an operator requeues it', async () => {
      const { type, queue } = subscribe('sample.requeue');
      const id = await write(type);
      await prisma.outboxEvent.update({ where: { id }, data: { attempts: 10, deadLetteredAt: new Date() } });

      await prisma.outboxEvent.update({ where: { id }, data: { attempts: 0, deadLetteredAt: null } });
      await makeDue(id);

      expect(await newPublisher().publishBatch()).toBe(1);
      expect(await jobIds(queue)).toHaveLength(1);
    });

    it('reports the backlog and dead letters separately', async () => {
      const { type } = subscribe('sample.gauges');
      await write(type);
      const dead = await write(type);
      await prisma.outboxEvent.update({ where: { id: dead }, data: { deadLetteredAt: new Date() } });

      await newPublisher().reportBacklog();

      expect(await gauge(metrics.outboxUnpublished)).toBe(1);
      expect(await gauge(metrics.outboxDeadLettered)).toBe(1);
      expect(await gauge(metrics.outboxOldestUnpublishedAge)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('stopping', () => {
    const writeMany = async (type: string, count: number) => {
      const ids: string[] = [];
      for (let i = 0; i < count; i++) ids.push(await write(type));
      return ids;
    };

    it('finishes the current event and hands back the rest with their attempts', async () => {
      const { type } = subscribe('sample.stop');
      await writeMany(type, 3);
      let publisher: OutboxPublisher | undefined = undefined;
      const started = newPublisher({
        add: () => {
          void publisher?.beforeApplicationShutdown();
          return Promise.resolve();
        },
      });
      publisher = started;

      expect(await started.publishBatch()).toBe(3);

      expect(await prisma.outboxEvent.count({ where: { publishedAt: { not: null }, attempts: 1 } })).toBe(1);
      expect(await prisma.outboxEvent.count({ where: { publishedAt: null, attempts: 0, claimedBy: null } })).toBe(2);
    });

    it('waits for the batch in flight before shutdown continues', async () => {
      const { type } = subscribe('sample.drain');
      const id = await write(type);
      let finishPublish: () => void = () => undefined;
      let markStarted: () => void = () => undefined;
      const publishing = new Promise<void>((resolve) => (markStarted = resolve));
      const publisher = newPublisher({
        add: () => {
          markStarted();
          return new Promise<void>((resolve) => (finishPublish = resolve));
        },
      });

      publisher.onApplicationBootstrap();
      await publishing;
      let stopped = false;
      const stopping = publisher.beforeApplicationShutdown().then(() => (stopped = true));
      await sleep(50);
      expect(stopped).toBe(false);

      finishPublish();
      await stopping;
      expect((await stored(id)).publishedAt).not.toBeNull();
    });

    it('hands back events it has no time left to start inside the lease', async () => {
      const { type } = subscribe('sample.budget');
      await writeMany(type, 10);

      await newPublisher({
        add: () => sleep(40),
        env: { OUTBOX_LEASE_MS: '200', OUTBOX_PUBLISH_TIMEOUT_MS: '60' },
      }).publishBatch();

      const published = await prisma.outboxEvent.count({ where: { publishedAt: { not: null } } });
      expect(published).toBeGreaterThan(0);
      expect(published).toBeLessThan(10);
      expect(await prisma.outboxEvent.count({ where: { publishedAt: null, attempts: 0 } })).toBe(10 - published);
    });
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
