import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Redis } from 'ioredis';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { REDIS_CLIENT } from '../../src/shared/infrastructure/redis';
import { createApiTestApp, testConfig } from '../support/test-app';

const LIMIT = 3;

describe('rate limit on /v1/auth/* (e2e)', () => {
  let app: NestExpressApplication;

  const randomIp = () => [...randomBytes(4)].join('.');
  const refreshFrom = (ip: string) =>
    request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('X-Forwarded-For', ip)
      .send({ refreshToken: 'unknown-token' });
  const googleFrom = (ip: string) =>
    request(app.getHttpServer()).post('/v1/auth/google').set('X-Forwarded-For', ip).send({ idToken: 'x' });

  beforeAll(async () => {
    app = await createApiTestApp(testConfig({ RATE_LIMIT_AUTH_PER_MINUTE: String(LIMIT), TRUST_PROXY_HOPS: '1' }));
    const redis = app.get<Redis>(REDIS_CLIENT);
    if (redis.status !== 'ready') await new Promise((resolve) => redis.once('ready', resolve));
  });

  afterAll(() => app.close());

  it('answers 429 RATE_LIMITED with Retry-After past the limit', async () => {
    const ip = randomIp();
    for (let i = 0; i < LIMIT; i++) await refreshFrom(ip).expect(401);

    const res = await refreshFrom(ip).expect(429);

    expect(res.body).toMatchObject({ code: 'RATE_LIMITED', status: 429 });
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('shares one budget across the auth routes', async () => {
    const ip = randomIp();
    for (let i = 0; i < LIMIT; i++) await refreshFrom(ip).expect(401);
    await googleFrom(ip).expect(429);
  });

  it('counts each client separately', async () => {
    const ip = randomIp();
    for (let i = 0; i < LIMIT + 1; i++) await refreshFrom(ip);
    await refreshFrom(randomIp()).expect(401);
  });

  it('does not limit other routes', async () => {
    const ip = randomIp();
    for (let i = 0; i < LIMIT + 2; i++) {
      await request(app.getHttpServer()).get('/health/live').set('X-Forwarded-For', ip).expect(200);
    }
  });
});
