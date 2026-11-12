import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { createFixtureWorld } from '../support/football';
import { bearer, devSignIn, type SignedIn } from '../support/sign-in';
import { createApiTestApp } from '../support/test-app';

const FUTURE = '2040-01-01T20:00:00Z';
const PAST = '2020-01-01T20:00:00Z';
const exact = (home: unknown, away: unknown) => ({ picks: [{ type: 'EXACT_SCORE', home, away }] });

describe('predictions API (e2e)', () => {
  let app: NestExpressApplication;
  let session: SignedIn;
  let world: Awaited<ReturnType<typeof createFixtureWorld>>;

  const path = (matchId: string) => `/v1/matches/${matchId}/prediction`;
  const put = (matchId: string, body: object, as = session) =>
    request(app.getHttpServer())
      .put(path(matchId))
      .set(...bearer(as))
      .send(body);
  const get = (matchId: string, as = session) =>
    request(app.getHttpServer())
      .get(path(matchId))
      .set(...bearer(as));
  const codeOf = (res: request.Response) => (res.body as { code: string }).code;
  const futureMatch = async () => (await world.createMatch(FUTURE)).id;

  beforeAll(async () => {
    app = await createApiTestApp();
    session = await devSignIn(app);
    world = await createFixtureWorld(app.get(PrismaService));
  });

  afterAll(() => app.close());

  it('requires an access token', async () => {
    await request(app.getHttpServer()).put(path(randomUUID())).send(exact(1, 0)).expect(401);
  });

  it('saves a prediction and returns the result derived from the score', async () => {
    const matchId = await futureMatch();
    const res = await put(matchId, exact(2, 1)).expect(200);

    expect(res.body).toMatchObject({
      matchId,
      revision: 1,
      status: 'ACTIVE',
      locked: false,
      picks: [
        { type: 'EXACT_SCORE', home: 2, away: 1 },
        { type: 'RESULT', outcome: 'HOME' },
      ],
    });
  });

  it('reads back your own prediction and raises the revision on an edit', async () => {
    const matchId = await futureMatch();
    await put(matchId, exact(0, 0)).expect(200);
    await put(matchId, exact(0, 1)).expect(200);

    const res = await get(matchId).expect(200);
    expect(res.body).toMatchObject({
      revision: 2,
      locked: false,
      picks: [
        { type: 'EXACT_SCORE', home: 0, away: 1 },
        { type: 'RESULT', outcome: 'AWAY' },
      ],
    });
  });

  it("keeps one user's prediction away from another", async () => {
    const matchId = await futureMatch();
    await put(matchId, exact(1, 1)).expect(200);

    const other = await devSignIn(app);
    expect(codeOf(await get(matchId, other).expect(404))).toBe('NOT_FOUND');
  });

  it('reports an existing prediction as locked after kickoff', async () => {
    const matchId = await futureMatch();
    await put(matchId, exact(3, 3)).expect(200);
    await app.get(PrismaService).match.update({ where: { id: matchId }, data: { kickoffAt: new Date(PAST) } });

    expect((await get(matchId).expect(200)).body).toMatchObject({ locked: true });
    expect(codeOf(await put(matchId, exact(4, 3)).expect(409))).toBe('PREDICTION_LOCKED');
  });

  it('answers 409 for a postponed match', async () => {
    const match = await world.createMatch(FUTURE, 'POSTPONED');
    expect(codeOf(await put(match.id, exact(1, 0)).expect(409))).toBe('MATCH_NOT_PREDICTABLE');
  });

  it('answers 404 for an unknown match', async () => {
    expect(codeOf(await put(randomUUID(), exact(1, 0)).expect(404))).toBe('NOT_FOUND');
    await get(randomUUID()).expect(404);
  });

  it.each([
    ['no picks', { picks: [] }],
    ['a result pick', { picks: [{ type: 'RESULT' }] }],
    ['too many goals', exact(21, 0)],
    ['a negative score', exact(-1, 0)],
  ])('answers 422 for %s', async (_name, body) => {
    expect(codeOf(await put(await futureMatch(), body).expect(422))).toBe('PREDICTION_INVALID_PICKS');
  });

  it.each([
    ['a missing body field', {}],
    ['a text score', exact('two', 0)],
  ])('answers 400 for %s', async (_name, body) => {
    expect(codeOf(await put(await futureMatch(), body).expect(400))).toBe('VALIDATION_FAILED');
  });

  it('answers 400 for a match id that is not a uuid', async () => {
    await put('not-a-uuid', exact(1, 0)).expect(400);
  });

  it("shows a friend's prediction only after kickoff, and nobody else's (DEC-21)", async () => {
    const [owner, friend, stranger] = [await devSignIn(app), await devSignIn(app), await devSignIn(app)];
    const prisma = app.get(PrismaService);
    const started = await world.createMatch(PAST, 'FINISHED');
    await prisma.prediction.create({
      data: {
        id: randomUUID(),
        userId: owner.userId,
        matchId: started.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        picks: { create: { pickType: 'EXACT_SCORE', homeScore: 3, awayScore: 0 } },
      },
    });
    const sent = await request(app.getHttpServer())
      .post('/v1/friend-requests')
      .set(...bearer(owner))
      .send({ userId: friend.userId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/friend-requests/${(sent.body as { id: string }).id}/accept`)
      .set(...bearer(friend))
      .expect(200);

    const forMatch = await request(app.getHttpServer())
      .get(`/v1/matches/${started.id}/predictions/friends`)
      .set(...bearer(friend))
      .expect(200);
    expect(forMatch.body).toMatchObject({
      items: [
        {
          user: { id: owner.userId },
          picks: [
            { type: 'EXACT_SCORE', home: 3, away: 0 },
            { type: 'RESULT', outcome: 'HOME' },
          ],
          score: null,
        },
      ],
    });
    const history = await request(app.getHttpServer())
      .get(`/v1/users/${owner.userId}/predictions`)
      .set(...bearer(friend))
      .expect(200);
    expect((history.body as { items: { matchId: string }[] }).items.map((item) => item.matchId)).toEqual([started.id]);
    const refused = await request(app.getHttpServer())
      .get(`/v1/users/${owner.userId}/predictions`)
      .set(...bearer(stranger))
      .expect(404);
    expect(codeOf(refused)).toBe('USER_NOT_FOUND');
  });
});
