import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AppConfig } from '../config';
import { DEFAULT_JOB_OPTIONS } from './job-defaults';

/**
 * Producer-side BullMQ queues, created lazily and shared per name. Consumers (processors) live in each
 * module's `*JobsModule`, which only the worker imports (src/modules/README.md).
 */
@Injectable()
export class QueueProvider implements OnApplicationShutdown {
  private readonly queues = new Map<string, Queue>();

  constructor(private readonly config: AppConfig) {}

  get(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, {
        connection: { url: this.config.redisUrl },
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      });
      this.queues.set(name, queue);
    }
    return queue;
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    this.queues.clear();
  }
}
