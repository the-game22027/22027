import { Injectable } from '@nestjs/common';

/**
 * Which handler consumes which event, on which queue. A module registers its subscriptions in
 * `onModuleInit`; the publisher fans each event out to one job per subscriber.
 */
export interface OutboxSubscription {
  eventType: string;
  /** Stable, unique handler name, e.g. `points.record-prediction-points`. Part of the job id. */
  subscriber: string;
  queue: string;
}

@Injectable()
export class OutboxSubscriptionRegistry {
  private readonly byEventType = new Map<string, OutboxSubscription[]>();

  register(subscription: OutboxSubscription): void {
    if (/[:\s]/.test(subscription.subscriber)) {
      throw new Error(`Invalid subscriber name "${subscription.subscriber}": no ':' or whitespace`);
    }
    const existing = this.byEventType.get(subscription.eventType) ?? [];
    if (existing.some((s) => s.subscriber === subscription.subscriber)) {
      throw new Error(`Duplicate subscriber "${subscription.subscriber}" for ${subscription.eventType}`);
    }
    this.byEventType.set(subscription.eventType, [...existing, subscription]);
  }

  forEvent(eventType: string): readonly OutboxSubscription[] {
    return this.byEventType.get(eventType) ?? [];
  }

  queueNames(): string[] {
    return [...new Set([...this.byEventType.values()].flat().map((s) => s.queue))].sort();
  }
}
