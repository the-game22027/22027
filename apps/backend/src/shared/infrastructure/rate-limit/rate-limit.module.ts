import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import { AppConfig } from '../config';
import { REDIS_CLIENT } from '../redis';
import { RedisThrottlerStorage } from './redis-throttler.storage';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [AppConfig, REDIS_CLIENT],
      useFactory: (config: AppConfig, redis: Redis) => ({
        throttlers: [{ ttl: 60_000, limit: config.rateLimit.authPerMinute }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
  ],
})
export class RateLimitModule {}
