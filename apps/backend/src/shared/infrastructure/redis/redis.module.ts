import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfig } from '../config';

/** General-purpose Redis client (health checks, matchmaking and rate limits later). BullMQ has its own connections. */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [AppConfig],
      useFactory: (config: AppConfig): Redis => {
        const client = new Redis(config.redisUrl, {
          // Fail fast instead of queueing commands while Redis is down (readiness must report it).
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
        });
        // Without a listener ioredis reports connection errors as unhandled; log them and keep reconnecting.
        const logger = new Logger('Redis');
        client.on('error', (error: Error) => logger.warn(`Redis connection error: ${error.message}`));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.redis.status !== 'end') {
      await this.redis.quit().catch(() => this.redis.disconnect());
    }
  }
}
