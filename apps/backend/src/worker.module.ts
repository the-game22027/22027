import { type DynamicModule, Module } from '@nestjs/common';
import type { AppConfig } from '@shared/infrastructure/config';
import { CoreModule } from '@shared/infrastructure/core.module';
import { OutboxPublisherModule } from '@shared/infrastructure/outbox';

/**
 * Root module of the worker process: outbox publisher, BullMQ processors (`*JobsModule` of each
 * business module) and schedulers. It serves only /health and /metrics over HTTP.
 */
@Module({})
export class WorkerModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: WorkerModule,
      imports: [CoreModule.register(config), OutboxPublisherModule],
    };
  }
}
