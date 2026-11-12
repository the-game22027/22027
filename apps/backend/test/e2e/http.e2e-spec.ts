import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createApiTestApp, testConfig } from '../support/test-app';
import { writeBattleConfigFile } from '../support/battle-config';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('HTTP cross-cutting behaviour (development mode)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createApiTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('echoes a safe X-Request-Id and generates one when absent', async () => {
    const given = await request(app.getHttpServer()).get('/health/live').set('X-Request-Id', 'client-req-42');
    expect(given.headers['x-request-id']).toBe('client-req-42');

    const generated = await request(app.getHttpServer()).get('/health/live');
    expect(generated.headers['x-request-id']).toMatch(UUID);

    const unsafe = await request(app.getHttpServer()).get('/health/live').set('X-Request-Id', 'bad id with spaces');
    expect(unsafe.headers['x-request-id']).toMatch(UUID);
  });

  it('serves routes under /v1 only', async () => {
    await request(app.getHttpServer())
      .post('/v1/_dev/echo')
      .send({ message: 'hi', repeat: 2 })
      .expect(200, { message: 'hi hi' });
    await request(app.getHttpServer()).post('/_dev/echo').send({ message: 'hi' }).expect(404);
  });

  it('returns 400 VALIDATION_FAILED problem+json with field errors', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/_dev/echo')
      .set('X-Request-Id', 'trace-validation')
      .send({ message: '', unknownField: true })
      .expect(400);

    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.body).toMatchObject({
      type: '/errors/VALIDATION_FAILED',
      status: 400,
      code: 'VALIDATION_FAILED',
      instance: '/v1/_dev/echo',
      traceId: 'trace-validation',
    });
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'message', code: 'isLength' }),
        expect.objectContaining({ field: 'unknownField', code: 'whitelistValidation' }),
      ]),
    );
  });

  it('maps a domain error to problem+json with traceId equal to X-Request-Id', async () => {
    const res = await request(app.getHttpServer()).get('/v1/_dev/sample-conflict').expect(409);
    expect(res.body).toMatchObject({ code: 'SAMPLE_CONFLICT', status: 409, type: '/errors/SAMPLE_CONFLICT' });
    expect(res.body.traceId).toBe(res.headers['x-request-id']);
  });

  it('answers malformed JSON and oversized bodies with problem+json', async () => {
    const malformed = await request(app.getHttpServer())
      .post('/v1/_dev/echo')
      .set('Content-Type', 'application/json')
      .send('{bad json')
      .expect(400);
    expect(malformed.body.code).toBe('BAD_REQUEST');

    const huge = await request(app.getHttpServer())
      .post('/v1/_dev/echo')
      .send({ message: 'x'.repeat(200 * 1024) })
      .expect(413);
    expect(huge.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('exposes Swagger UI and Prometheus metrics outside production', async () => {
    await request(app.getHttpServer()).get('/docs').expect(200);
    const metrics = await request(app.getHttpServer()).get('/metrics').expect(200);
    expect(metrics.text).toContain('http_request_duration_seconds');
  });

  it('builds the OpenAPI document from every DTO', async () => {
    const res = await request(app.getHttpServer()).get('/docs-json').expect(200);
    expect(res.body.paths).toHaveProperty(['/v1/me/play-state']);
    expect(res.body.components.schemas.PlayStateDto.properties).toHaveProperty('room');
  });
});

describe('production mode', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    // Production refuses placeholder battle values (ADR-0018), so this boot gets a file marked as reviewed.
    const battleConfig = writeBattleConfigFile((config) => {
      config['devOnly'] = false;
    });
    app = await createApiTestApp(testConfig({ NODE_ENV: 'production', BATTLE_CONFIG_PATH: battleConfig }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('does not expose Swagger, Bull Board or development routes', async () => {
    await request(app.getHttpServer()).get('/docs').expect(404);
    await request(app.getHttpServer()).get('/admin/queues').expect(404);
    await request(app.getHttpServer()).post('/v1/_dev/echo').send({ message: 'hi' }).expect(404);
    await request(app.getHttpServer()).post('/v1/_dev/auth/sign-in').send({ subject: 'x' }).expect(404);
  });
});
