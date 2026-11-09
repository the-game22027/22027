import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bearer, devSignIn } from '../support/sign-in';
import { createApiTestApp } from '../support/test-app';

describe('/v1/me (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createApiTestApp();
  });

  afterAll(() => app.close());

  describe('access token guard', () => {
    it('rejects a request with no token', async () => {
      const res = await request(app.getHttpServer()).get('/v1/me').expect(401);
      expect(res.body).toMatchObject({ code: 'UNAUTHENTICATED', status: 401 });
    });

    it('rejects a token that is not a valid JWT', async () => {
      await request(app.getHttpServer()).get('/v1/me').set('Authorization', 'Bearer not-a-jwt').expect(401);
    });

    it('rejects a non-Bearer scheme', async () => {
      const session = await devSignIn(app);
      await request(app.getHttpServer()).get('/v1/me').set('Authorization', `Basic ${session.accessToken}`).expect(401);
    });

    it('leaves health checks public', async () => {
      await request(app.getHttpServer()).get('/health/live').expect(200);
    });
  });

  it('returns the signed-in user', async () => {
    const session = await devSignIn(app);
    const res = await request(app.getHttpServer())
      .get('/v1/me')
      .set(...bearer(session))
      .expect(200);
    expect(res.body).toMatchObject({ id: session.userId, locale: 'ar', identities: [{ provider: 'GOOGLE' }] });
  });
});
