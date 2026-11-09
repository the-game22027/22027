import type { Redis } from 'ioredis';
import { RedisThrottlerStorage } from './redis-throttler.storage';

const storageReturning = (result: Promise<unknown>) =>
  new RedisThrottlerStorage({ eval: () => result } as unknown as Redis);

describe('RedisThrottlerStorage', () => {
  it('allows hits up to the limit', async () => {
    const record = await storageReturning(Promise.resolve([3, 30_000])).increment('key', 60_000, 3);
    expect(record).toEqual({ totalHits: 3, timeToExpire: 30, isBlocked: false, timeToBlockExpire: 0 });
  });

  it('blocks past the limit until the window ends', async () => {
    const record = await storageReturning(Promise.resolve([4, 29_001])).increment('key', 60_000, 3);
    expect(record).toEqual({ totalHits: 4, timeToExpire: 30, isBlocked: true, timeToBlockExpire: 30 });
  });

  it('lets the request through when Redis is down', async () => {
    const record = await storageReturning(Promise.reject(new Error('offline'))).increment('key', 60_000, 3);
    expect(record.isBlocked).toBe(false);
  });
});
