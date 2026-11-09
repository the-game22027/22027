import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { FakeGoogle } from '../support/fake-google';
import { createApiTestApp, testConfig } from '../support/test-app';

describe('auth (e2e)', () => {
  let app: NestExpressApplication;
  let google: FakeGoogle;

  beforeAll(async () => {
    google = await new FakeGoogle().start();
    app = await createApiTestApp(testConfig(google.env()));
  });

  afterAll(async () => {
    await app.close();
    await google.stop();
  });

  describe('POST /v1/auth/google', () => {
    it('creates an account (201), then signs back in to it (200)', async () => {
      const idToken = await google.idToken(`sub-${randomUUID()}`, { email: 'fan@example.com', name: 'Fan' });

      const created = await request(app.getHttpServer())
        .post('/v1/auth/google')
        .send({ idToken, device: { platform: 'android', name: 'Pixel 9' } })
        .expect(201);
      expect(created.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        isNewUser: true,
        user: {
          displayName: 'Fan',
          locale: 'ar',
          identities: [{ provider: 'GOOGLE', label: 'fan@example.com' }],
        },
      });
      expect(Date.parse(String(created.body.accessTokenExpiresAt))).toBeGreaterThan(Date.now());

      const again = await request(app.getHttpServer()).post('/v1/auth/google').send({ idToken }).expect(200);
      expect(again.body).toMatchObject({ isNewUser: false, user: { id: created.body.user.id } });
    });

    it('answers a forged Google token with 401 PROVIDER_TOKEN_INVALID', async () => {
      const forged = await new FakeGoogle().idToken('attacker');
      const res = await request(app.getHttpServer()).post('/v1/auth/google').send({ idToken: forged }).expect(401);
      expect(res.body).toMatchObject({ code: 'PROVIDER_TOKEN_INVALID', status: 401 });
    });

    it('validates the body', async () => {
      const res = await request(app.getHttpServer()).post('/v1/auth/google').send({}).expect(400);
      expect(res.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'idToken' })]));
    });
  });

  describe('POST /v1/_dev/auth/sign-in', () => {
    it('signs in as a made-up account outside production', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/_dev/auth/sign-in')
        .send({ subject: `tester-${randomUUID()}`, displayName: 'Tester' })
        .expect(201);
      expect(res.body).toMatchObject({ isNewUser: true, user: { displayName: 'Tester' } });
    });
  });

  describe('POST /v1/auth/refresh', () => {
    it('rotates the token, and a reused old token revokes the whole sign-in', async () => {
      const idToken = await google.idToken(`sub-${randomUUID()}`);
      const signedIn = await request(app.getHttpServer()).post('/v1/auth/google').send({ idToken }).expect(201);
      const first = String(signedIn.body.refreshToken);

      const rotated = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: first })
        .expect(200);
      expect(rotated.body).toMatchObject({ isNewUser: false, user: { id: signedIn.body.user.id } });
      const second = String(rotated.body.refreshToken);
      expect(second).not.toBe(first);

      const reused = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: first })
        .expect(401);
      expect(reused.body.code).toBe('REFRESH_TOKEN_REUSED');

      const afterTheft = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: second })
        .expect(401);
      expect(afterTheft.body.code).toBe('REFRESH_TOKEN_INVALID');
    });
  });

  it('P1 exit: Google sign-in, /me, refresh, then a replayed token revokes the sign-in', async () => {
    const http = () => request(app.getHttpServer());
    const idToken = await google.idToken(`sub-${randomUUID()}`, { email: 'exit@example.com', name: 'Exit' });

    const signedIn = await http().post('/v1/auth/google').send({ idToken }).expect(201);
    const me = await http().get('/v1/me').set('Authorization', `Bearer ${signedIn.body.accessToken}`).expect(200);
    expect(me.body).toMatchObject({ id: signedIn.body.user.id, displayName: 'Exit' });

    const first = String(signedIn.body.refreshToken);
    const rotated = await http().post('/v1/auth/refresh').send({ refreshToken: first }).expect(200);
    const replay = await http().post('/v1/auth/refresh').send({ refreshToken: first }).expect(401);
    expect(replay.body).toMatchObject({ code: 'REFRESH_TOKEN_REUSED' });

    await http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: String(rotated.body.refreshToken) })
      .expect(401);
  });
});
