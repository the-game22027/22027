import { Inject, Injectable } from '@nestjs/common';
import { type HealthCheckAttempt, HealthIndicatorService } from '@nestjs/terminus';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly indicator: HealthIndicatorService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  ping(key: string): HealthCheckAttempt<string> {
    return this.indicator
      .check(key)
      .attempt(async () => {
        await this.redis.ping();
      })
      .withTimeout(1000);
  }
}
