import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { bearer, devSignIn, type SignedIn } from '../support/sign-in';
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

  describe('PATCH /v1/me', () => {
    const uniqueUsername = () => `fan_${randomBytes(6).toString('hex')}`;
    const patch = (session: SignedIn, body: object) =>
      request(app.getHttpServer())
        .patch('/v1/me')
        .set(...bearer(session))
        .send(body);

    it('changes only the fields it receives', async () => {
      const session = await devSignIn(app);
      const username = uniqueUsername();

      const res = await patch(session, { displayName: '  Mo   Salah ', username, locale: 'en' }).expect(200);
      expect(res.body).toMatchObject({ displayName: 'Mo Salah', username, locale: 'en' });

      const after = await patch(session, { locale: 'ar' }).expect(200);
      expect(after.body).toMatchObject({ displayName: 'Mo Salah', username, locale: 'ar' });
    });

    it('clears a nullable field with null', async () => {
      const session = await devSignIn(app);
      await patch(session, { username: uniqueUsername() }).expect(200);
      const res = await patch(session, { username: null }).expect(200);
      expect(res.body).toMatchObject({ username: null });
    });

    it('treats usernames as case-insensitive when checking they are free', async () => {
      const username = uniqueUsername();
      await patch(await devSignIn(app), { username }).expect(200);

      const res = await patch(await devSignIn(app), { username: username.toUpperCase() }).expect(409);
      expect(res.body).toMatchObject({ code: 'USERNAME_TAKEN' });
    });

    it('rejects a badly formed username', async () => {
      const res = await patch(await devSignIn(app), { username: 'no spaces!' }).expect(400);
      expect(res.body).toMatchObject({ code: 'USERNAME_INVALID' });
    });

    it('rejects a blank display name', async () => {
      const res = await patch(await devSignIn(app), { displayName: '    ' }).expect(400);
      expect(res.body).toMatchObject({ code: 'DISPLAY_NAME_INVALID' });
    });

    it.each([
      { displayName: null },
      { locale: 'fr' },
      { avatarUrl: 'http://not-https.example/a.png' },
      { status: 'X' },
    ])('rejects %j at the edge', async (body) => {
      const res = await patch(await devSignIn(app), body).expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });

  it('DELETE /v1/me answers 202 and ends the sessions', async () => {
    const session = await devSignIn(app);
    await request(app.getHttpServer())
      .delete('/v1/me')
      .set(...bearer(session))
      .expect(202);
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);
  });
});
