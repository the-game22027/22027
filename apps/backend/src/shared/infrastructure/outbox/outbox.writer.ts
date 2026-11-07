import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from '@shared/kernel';
import type { Prisma } from '@generated/prisma/client';
import type { PrismaService } from '../persistence';
import type { OutboxEventInput } from './outbox-event';

export class OutboxRequiresTransactionError extends Error {
  constructor() {
    super('OutboxWriter.write must run inside a transaction (use @Transactional or TransactionHost.withTransaction)');
  }
}

/**
 * Writes events in the **same transaction** as the state change (ADR-0004): if the transaction rolls
 * back, the event never existed. Writing outside a transaction is a bug, so it throws.
 */
@Injectable()
export class OutboxWriter {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async write(event: OutboxEventInput): Promise<string> {
    if (!this.txHost.isTransactionActive()) {
      throw new OutboxRequiresTransactionError();
    }
    const id = this.ids.next();
    await this.txHost.tx.outboxEvent.create({
      data: {
        id,
        type: event.type,
        version: event.version,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload as Prisma.InputJsonObject,
        occurredAt: event.occurredAt ?? this.clock.now(),
      },
    });
    return id;
  }
}
