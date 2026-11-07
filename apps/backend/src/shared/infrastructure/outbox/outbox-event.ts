/** What a use case writes to the outbox (docs/architecture/01-modules.md §6). Payloads carry ids, not entities. */
export interface OutboxEventInput {
  type: string;
  version: number;
  aggregateType: string;
  aggregateId: string;
  payload: Readonly<Record<string, unknown>>;
  /** Business time of the change; defaults to the injected clock's now. */
  occurredAt?: Date;
}

/** Job data delivered to every subscriber queue. */
export interface OutboxEnvelope {
  eventId: string;
  type: string;
  version: number;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

/** BullMQ forbids ':' in custom ids, so the dedup key is `<eventId>__<subscriber>`. */
export function outboxJobId(eventId: string, subscriber: string): string {
  return `${eventId}__${subscriber}`;
}
