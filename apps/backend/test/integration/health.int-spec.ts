import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createApiTestApp, testConfig } from '../support/test-app';

/** Readiness must reflect the real dependencies, so orchestration stops routing traffic when one is down. */
describe('health checks', () => {
  const apps: NestExpressApplication[] = [];
  const boot = async (overrides: Record<string, string> = {}): Promise<NestExpressApplication> => {
    const app = await createApiTestApp(testConfig(overrides));
    apps.push(app);
    return app;
  };

  afterAll(async () => {
    await Promise.all(apps.map((app) => app.close()));
  });

  it('is live and ready when Postgres and Redis are reachable', async () => {
    const app = await boot();
    await request(app.getHttpServer()).get('/health/live').expect(200);
    const ready = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(ready.body).toMatchObject({ status: 'ok', info: { database: { status: 'up' }, redis: { status: 'up' } } });
  });

  it('is not ready when Redis is unreachable, but still live', async () => {
    const app = await boot({ REDIS_URL: 'redis://127.0.0.1:1' });
    await request(app.getHttpServer()).get('/health/live').expect(200);
    const ready = await request(app.getHttpServer()).get('/health/ready').expect(503);
    expect(ready.body).toMatchObject({ status: 'error', error: { redis: { status: 'down' } } });
  });

  it('is not ready when Postgres is unreachable', async () => {
    const app = await boot({ DATABASE_URL: 'postgresql://game:game@127.0.0.1:1/app' });
    const ready = await request(app.getHttpServer()).get('/health/ready').expect(503);
    expect(ready.body).toMatchObject({ status: 'error', error: { database: { status: 'down' } } });
  });
});
