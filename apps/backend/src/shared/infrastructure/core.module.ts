import { type DynamicModule, Module } from '@nestjs/common';
import { type AppConfig, ConfigModule } from './config';
import { HealthModule } from './health/health.module';
import { HttpModule } from './http/http.module';
import { KernelModule } from './kernel/kernel.module';
import { LoggingModule } from './logging/logging.module';
import { MetricsModule } from './metrics/metrics.module';
import { OutboxModule } from './outbox';
import { PersistenceModule } from './persistence';
import { RedisModule } from './redis';
import { RequestContextModule } from './request-context/request-context.module';

/** Cross-cutting infrastructure shared by the API and the worker process. */
@Module({})
export class CoreModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: CoreModule,
      imports: [
        ConfigModule.forRoot(config),
        KernelModule,
        RequestContextModule,
        LoggingModule,
        PersistenceModule,
        RedisModule,
        MetricsModule,
        HealthModule,
        HttpModule,
        OutboxModule,
      ],
    };
  }
}
