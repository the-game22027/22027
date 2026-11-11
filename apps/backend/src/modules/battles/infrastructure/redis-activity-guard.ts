import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '@shared/infrastructure/redis';
import type { Activity, ActivityGuard } from '../application/ports/activity-guard';

// A backstop, not a rule: if a process dies without releasing, the user is free again after this long.
const ACTIVITY_TTL_SECONDS = 2 * 60 * 60;

// Compare-and-set and compare-and-delete must be atomic, or a late release could end a newer activity.
const REPLACE_IF_CURRENT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
  return 1
end
return 0`;
const DELETE_IF_CURRENT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0`;

const keyOf = (userId: string): string => `act:${userId}`;

/** "One activity per user" in Redis (02 §4.8), so it holds across API instances. */
@Injectable()
export class RedisActivityGuard implements ActivityGuard {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async claimActivity(userId: string, activity: Activity): Promise<boolean> {
    return (await this.redis.set(keyOf(userId), activity, 'EX', ACTIVITY_TTL_SECONDS, 'NX')) === 'OK';
  }

  async replaceActivity(userId: string, from: Activity, to: Activity): Promise<boolean> {
    return (await this.redis.eval(REPLACE_IF_CURRENT, 1, keyOf(userId), from, to, ACTIVITY_TTL_SECONDS)) === 1;
  }

  async releaseActivity(userId: string, activity: Activity): Promise<void> {
    await this.redis.eval(DELETE_IF_CURRENT, 1, keyOf(userId), activity);
  }

  async findActivity(userId: string): Promise<Activity | null> {
    return (await this.redis.get(keyOf(userId))) as Activity | null;
  }

  async releaseEveryQueueActivity(): Promise<number> {
    // Runs at boot, possibly before the connection is up (the client has no offline queue).
    if (this.redis.status !== 'ready') await new Promise((resolve) => this.redis.once('ready', resolve));
    let released = 0;
    for await (const keys of this.redis.scanStream({ match: 'act:*', count: 500 })) {
      for (const key of keys as string[]) {
        const activity = await this.redis.get(key);
        if (activity?.startsWith('QUEUE:'))
          released += Number(await this.redis.eval(DELETE_IF_CURRENT, 1, key, activity));
      }
    }
    return released;
  }
}
