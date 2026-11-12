import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { bearer, type SignedIn } from '../support/sign-in';
import { createApiTestApp, testConfig } from '../support/test-app';

describe('friends, blocks and search (e2e)', () => {
  let app: NestExpressApplication;
  // A word no other test uses, so search results are only this file's players.
  const tag = `zq${randomUUID().slice(0, 6)}`;

  const signIn = async (displayName: string): Promise<SignedIn> => {
    const subject = randomUUID();
    const res = await request(app.getHttpServer()).post('/v1/_dev/auth/sign-in').send({ subject, displayName });
    const body = res.body as { accessToken: string; refreshToken: string; user: { id: string } };
    return { accessToken: body.accessToken, refreshToken: body.refreshToken, userId: body.user.id, subject };
  };
  const call = (as: SignedIn) => ({
    get: (path: string) =>
      request(app.getHttpServer())
        .get(path)
        .set(...bearer(as)),
    post: (path: string, body: object = {}) =>
      request(app.getHttpServer())
        .post(path)
        .set(...bearer(as))
        .send(body),
    put: (path: string) =>
      request(app.getHttpServer())
        .put(path)
        .set(...bearer(as)),
    delete: (path: string) =>
      request(app.getHttpServer())
        .delete(path)
        .set(...bearer(as)),
  });
  const codeOf = (res: request.Response) => (res.body as { code: string }).code;
  const idsOf = (res: request.Response) => (res.body as { items: { id: string }[] }).items.map((item) => item.id);
  const userIdsOf = (res: request.Response) =>
    (res.body as { items: { user: { id: string } }[] }).items.map((item) => item.user.id);

  beforeAll(async () => {
    // Low search limit so the rate limit test is short; each player has their own bucket.
    app = await createApiTestApp(testConfig({ RATE_LIMIT_USER_SEARCH_PER_MINUTE: '5' }));
  });

  afterAll(() => app.close());

  it('sends, repeats, lists and accepts a friend request', async () => {
    const [amir, bassem] = [await signIn(`Amir ${tag}`), await signIn(`Bassem ${tag}`)];

    const sent = await call(amir).post('/v1/friend-requests', { userId: bassem.userId }).expect(201);
    const requestId = (sent.body as { id: string }).id;
    expect(sent.body).toMatchObject({ status: 'PENDING', from: { id: amir.userId }, to: { id: bassem.userId } });
    const again = await call(amir).post('/v1/friend-requests', { userId: bassem.userId }).expect(200);
    expect((again.body as { id: string }).id).toBe(requestId);

    const reverse = await call(bassem).post('/v1/friend-requests', { userId: amir.userId }).expect(409);
    expect(reverse.body).toMatchObject({ code: 'FRIEND_REQUEST_EXISTS', requestId });

    expect(idsOf(await call(bassem).get('/v1/friend-requests?direction=incoming').expect(200))).toEqual([requestId]);
    expect(idsOf(await call(amir).get('/v1/friend-requests?direction=outgoing').expect(200))).toEqual([requestId]);
    expect(await call(bassem).get(`/v1/users/${amir.userId}`).expect(200)).toMatchObject({
      body: { relationship: 'REQUEST_RECEIVED', requestId },
    });

    expect(codeOf(await call(amir).post(`/v1/friend-requests/${requestId}/accept`).expect(404))).toBe(
      'FRIEND_REQUEST_NOT_FOUND',
    );
    const accepted = await call(bassem).post(`/v1/friend-requests/${requestId}/accept`).expect(200);
    expect(accepted.body).toMatchObject({ status: 'ACCEPTED' });
    expect(codeOf(await call(bassem).post(`/v1/friend-requests/${requestId}/accept`).expect(409))).toBe(
      'FRIEND_REQUEST_NOT_PENDING',
    );

    expect(userIdsOf(await call(amir).get('/v1/me/friends').expect(200))).toEqual([bassem.userId]);
    expect(userIdsOf(await call(bassem).get('/v1/me/friends').expect(200))).toEqual([amir.userId]);
    expect(codeOf(await call(amir).post('/v1/friend-requests', { userId: bassem.userId }).expect(409))).toBe(
      'ALREADY_FRIENDS',
    );
    expect(await call(amir).get(`/v1/users/${bassem.userId}`).expect(200)).toMatchObject({
      body: { relationship: 'FRIENDS', requestId: null },
    });

    await call(amir).delete(`/v1/me/friends/${bassem.userId}`).expect(204);
    await call(amir).delete(`/v1/me/friends/${bassem.userId}`).expect(204);
    expect(userIdsOf(await call(bassem).get('/v1/me/friends').expect(200))).toEqual([]);
  });

  it('declines and cancels, each only by the right player', async () => {
    const [amir, bassem] = [await signIn(`Amir ${tag}`), await signIn(`Bassem ${tag}`)];
    const first = (await call(amir).post('/v1/friend-requests', { userId: bassem.userId }).expect(201)).body as {
      id: string;
    };
    await call(bassem).post(`/v1/friend-requests/${first.id}/decline`).expect(200);

    const second = (await call(amir).post('/v1/friend-requests', { userId: bassem.userId }).expect(201)).body as {
      id: string;
    };
    expect(codeOf(await call(bassem).delete(`/v1/friend-requests/${second.id}`).expect(404))).toBe(
      'FRIEND_REQUEST_NOT_FOUND',
    );
    await call(amir).delete(`/v1/friend-requests/${second.id}`).expect(204);
    expect(idsOf(await call(bassem).get('/v1/friend-requests?direction=incoming').expect(200))).toEqual([]);
  });

  it('refuses yourself and unknown players', async () => {
    const amir = await signIn(`Amir ${tag}`);
    expect(codeOf(await call(amir).post('/v1/friend-requests', { userId: amir.userId }).expect(422))).toBe(
      'CANNOT_TARGET_YOURSELF',
    );
    expect(codeOf(await call(amir).post('/v1/friend-requests', { userId: randomUUID() }).expect(404))).toBe(
      'USER_NOT_FOUND',
    );
    expect(codeOf(await call(amir).put(`/v1/me/blocks/${amir.userId}`).expect(422))).toBe('CANNOT_TARGET_YOURSELF');
    expect(await call(amir).get(`/v1/users/${amir.userId}`).expect(200)).toMatchObject({
      body: { relationship: 'SELF' },
    });
  });

  it('makes a block look like an unknown player, both ways, until unblocked', async () => {
    const [amir, carim] = [await signIn(`Amir ${tag}`), await signIn(`Carim ${tag}`)];
    await call(carim).post('/v1/friend-requests', { userId: amir.userId }).expect(201);

    await call(amir).put(`/v1/me/blocks/${carim.userId}`).expect(204);
    await call(amir).put(`/v1/me/blocks/${carim.userId}`).expect(204);

    expect(idsOf(await call(amir).get('/v1/friend-requests?direction=incoming').expect(200))).toEqual([]);
    expect(userIdsOf(await call(amir).get('/v1/me/blocks').expect(200))).toEqual([carim.userId]);
    for (const [viewer, other] of [
      [carim, amir],
      [amir, carim],
    ] as const) {
      expect(codeOf(await call(viewer).get(`/v1/users/${other.userId}`).expect(404))).toBe('USER_NOT_FOUND');
      expect(codeOf(await call(viewer).post('/v1/friend-requests', { userId: other.userId }).expect(404))).toBe(
        'USER_NOT_FOUND',
      );
    }
    const search = await call(carim)
      .get(`/v1/users?query=${encodeURIComponent(`Amir ${tag}`)}`)
      .expect(200);
    expect(idsOf(search)).not.toContain(amir.userId);

    await call(amir).delete(`/v1/me/blocks/${carim.userId}`).expect(204);
    expect(await call(carim).get(`/v1/users/${amir.userId}`).expect(200)).toMatchObject({
      body: { relationship: 'NONE' },
    });
  });

  it('searches by display name or username prefix, never yourself, page by page', async () => {
    const searcher = await signIn(`Searcher ${tag}`);
    const found = [await signIn(`Dina ${tag}`), await signIn(`Dalia ${tag}`)];

    const page1 = await call(searcher).get(`/v1/users?query=${tag}&limit=2`).expect(200);
    const first = idsOf(page1);
    expect(first).toHaveLength(2);
    expect(first).not.toContain(searcher.userId);
    const cursor = (page1.body as { nextCursor: string | null }).nextCursor;
    expect(cursor).not.toBeNull();
    const page2 = await call(searcher)
      .get(`/v1/users?query=${tag}&limit=2&cursor=${cursor ?? ''}`)
      .expect(200);
    expect(idsOf(page2).some((id) => first.includes(id))).toBe(false);

    const dina = await call(searcher)
      .get(`/v1/users?query=${encodeURIComponent(`dina ${tag}`)}`)
      .expect(200);
    expect(idsOf(dina)).toEqual([found[0]?.userId]);
    expect(codeOf(await call(searcher).get('/v1/users?query=%20a%20').expect(400))).toBe('VALIDATION_FAILED');
    expect(codeOf(await call(searcher).get(`/v1/users?query=${tag}&cursor=abc`).expect(400))).toBe('INVALID_CURSOR');
  });

  it('limits searches per player and answers 429 with Retry-After', async () => {
    const [eager, other] = [await signIn(`Eager ${tag}`), await signIn(`Other ${tag}`)];
    for (let attempt = 0; attempt < 5; attempt++) await call(eager).get(`/v1/users?query=${tag}`).expect(200);

    const limited = await call(eager).get(`/v1/users?query=${tag}`).expect(429);
    expect(codeOf(limited)).toBe('RATE_LIMITED');
    expect(limited.headers['retry-after']).toBeDefined();
    await call(other).get(`/v1/users?query=${tag}`).expect(200);
  });
});
