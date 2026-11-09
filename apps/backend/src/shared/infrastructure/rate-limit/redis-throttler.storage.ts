import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';

interface ThrottlerRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

// One script so the counter can never be left without an expiry between the two commands.
const INCREMENT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return { hits, redis.call('PTTL', KEYS[1]) }`;

/** Fixed window per key, shared by every API instance. */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  constructor(private readonly redis: Redis) {}

  async increment(key: string, ttl: number, limit: number): Promise<ThrottlerRecord> {
    try {
      const [totalHits, remainingMs] = (await this.redis.eval(INCREMENT, 1, key, ttl)) as [number, number];
      const seconds = Math.ceil(remainingMs / 1000);
      const isBlocked = totalHits > limit;
      return { totalHits, timeToExpire: seconds, isBlocked, timeToBlockExpire: isBlocked ? seconds : 0 };
    } catch (error) {
      // Fails open: a Redis outage must not lock every player out of signing in.
      this.logger.warn(`Rate limit skipped: ${error instanceof Error ? error.message : String(error)}`);
      return { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
    }
  }
}
