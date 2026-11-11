import { Test, type TestingModule } from '@nestjs/testing';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { RedisActivityGuard } from '../../src/modules/battles/infrastructure/redis-activity-guard';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { REDIS_CLIENT } from '../../src/shared/infrastructure/redis';
import { testConfig } from '../support/test-app';

describe('the activity guard in Redis', () => {
  let moduleRef: TestingModule;
  let guard: RedisActivityGuard;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [CoreModule.register(testConfig())],
      providers: [RedisActivityGuard],
    }).compile();
    await moduleRef.init();
    guard = moduleRef.get(RedisActivityGuard);
    const redis = moduleRef.get<Redis>(REDIS_CLIENT);
    if (redis.status !== 'ready') await new Promise((resolve) => redis.once('ready', resolve));
  });

  afterAll(() => moduleRef.close());

  it('gives a user one activity at a time and moves it only from the current one', async () => {
    const user = randomUUID();
    expect(await guard.claimActivity(user, 'QUEUE:t1')).toBe(true);
    expect(await guard.claimActivity(user, 'QUEUE:t2')).toBe(false);

    expect(await guard.replaceActivity(user, 'QUEUE:t2', 'BATTLE:b1')).toBe(false);
    expect(await guard.replaceActivity(user, 'QUEUE:t1', 'BATTLE:b1')).toBe(true);
    expect(await guard.findActivity(user)).toBe('BATTLE:b1');
  });

  it('ignores a late release of an activity that is no longer current', async () => {
    const user = randomUUID();
    await guard.claimActivity(user, 'QUEUE:old');
    await guard.replaceActivity(user, 'QUEUE:old', 'BATTLE:new');

    await guard.releaseActivity(user, 'QUEUE:old');
    expect(await guard.findActivity(user)).toBe('BATTLE:new');
    await guard.releaseActivity(user, 'BATTLE:new');
    expect(await guard.findActivity(user)).toBeNull();
  });

  it('frees every queued player after a restart, but not players in a battle', async () => {
    const queued = randomUUID();
    const playing = randomUUID();
    await guard.claimActivity(queued, 'QUEUE:q');
    await guard.claimActivity(playing, 'BATTLE:b');

    expect(await guard.releaseEveryQueueActivity()).toBeGreaterThanOrEqual(1);
    expect(await guard.findActivity(queued)).toBeNull();
    expect(await guard.findActivity(playing)).toBe('BATTLE:b');
    expect(await moduleRef.get<Redis>(REDIS_CLIENT).ttl(`act:${playing}`)).toBeGreaterThan(0);
  });
});
