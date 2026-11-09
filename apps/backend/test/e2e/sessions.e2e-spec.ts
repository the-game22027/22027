import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { bearer, devSignIn, type SignedIn } from '../support/sign-in';
import { createApiTestApp } from '../support/test-app';

interface SessionInfo {
  id: string;
  platform?: string;
  deviceName?: string;
  createdAt: string;
  current: boolean;
}

describe('sessions (e2e)', () => {
  let app: NestExpressApplication;

  const refresh = (refreshToken: string) =>
    request(app.getHttpServer()).post('/v1/auth/refresh').send({ refreshToken });
  const list = async (session: SignedIn) => {
    const res = await request(app.getHttpServer())
      .get('/v1/auth/sessions')
      .set(...bearer(session))
      .expect(200);
    return res.body as SessionInfo[];
  };

  beforeAll(async () => {
    app = await createApiTestApp();
  });

  afterAll(() => app.close());

  it('logout ends the session', async () => {
    const session = await devSignIn(app);
    await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set(...bearer(session))
      .expect(204);
    await refresh(session.refreshToken).expect(401);
  });

  it('logout still works with an access token issued before the last refresh', async () => {
    const session = await devSignIn(app);
    const refreshed = await refresh(session.refreshToken).expect(200);
    await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set(...bearer(session))
      .expect(204);
    await refresh(String(refreshed.body.refreshToken)).expect(401);
  });

  it('lists active devices and marks the current one', async () => {
    const subject = randomUUID();
    const phone = await devSignIn(app, subject, { platform: 'android', name: 'Pixel' });
    const tablet = await devSignIn(app, subject, { platform: 'ios', name: 'iPad' });

    const sessions = await list(phone);

    expect(sessions).toHaveLength(2);
    expect(sessions.find((session) => session.current)).toMatchObject({ platform: 'android', deviceName: 'Pixel' });
    expect(sessions.find((session) => !session.current)).toMatchObject({ platform: 'ios', deviceName: 'iPad' });

    await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set(...bearer(tablet))
      .expect(204);
    expect(await list(phone)).toHaveLength(1);
  });

  it('keeps the original sign-in time after a refresh', async () => {
    const session = await devSignIn(app);
    const [before] = await list(session);
    await refresh(session.refreshToken).expect(200);
    const [after] = await list(session);

    expect(after?.id).not.toBe(before?.id);
    expect(after?.createdAt).toBe(before?.createdAt);
    expect(after?.current).toBe(true);
  });

  it('signs another device out', async () => {
    const subject = randomUUID();
    const phone = await devSignIn(app, subject);
    const tablet = await devSignIn(app, subject);
    const other = (await list(phone)).find((session) => !session.current);

    await request(app.getHttpServer())
      .delete(`/v1/auth/sessions/${String(other?.id)}`)
      .set(...bearer(phone))
      .expect(204);

    await refresh(tablet.refreshToken).expect(401);
    await refresh(phone.refreshToken).expect(200);
  });

  it("answers 404 for another user's session, and leaves it alone", async () => {
    const mine = await devSignIn(app);
    const theirs = await devSignIn(app);
    const [target] = await list(theirs);

    const res = await request(app.getHttpServer())
      .delete(`/v1/auth/sessions/${String(target?.id)}`)
      .set(...bearer(mine))
      .expect(404);

    expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
    await refresh(theirs.refreshToken).expect(200);
  });
});
