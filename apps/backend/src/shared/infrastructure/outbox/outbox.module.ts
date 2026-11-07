import { Global, Module } from '@nestjs/common';
import { QueueProvider } from '../queue/queue-provider';
import { OutboxSubscriptionRegistry } from './outbox-subscriptions';
import { OutboxWriter } from './outbox.writer';
import { OutboxPublisher } from './outbox.publisher';

/** Writer + subscription registry + producer queues: available in both processes. */
@Global()
@Module({
  providers: [QueueProvider, OutboxSubscriptionRegistry, OutboxWriter],
  exports: [QueueProvider, OutboxSubscriptionRegistry, OutboxWriter],
})
export class OutboxModule {}

/** The publishing loop: imported by the worker only. */
@Module({
  providers: [OutboxPublisher],
  exports: [OutboxPublisher],
})
export class OutboxPublisherModule {}
