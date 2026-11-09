import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { createFixtureWorld } from '../support/football';
import { bearer, devSignIn, type SignedIn } from '../support/sign-in';
import { createApiTestApp } from '../support/test-app';

interface MatchPage {
  items: { id: string; predictable: boolean; homeTeam: { name: string }; awayTeam: { name: string } }[];
  nextCursor: string | null;
}

describe('football read API (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let session: SignedIn;

  const get = (path: string) =>
    request(app.getHttpServer())
      .get(path)
      .set(...bearer(session));
  const page = async (query: string) => (await get(`/v1/matches?${query}`).expect(200)).body as MatchPage;

  beforeAll(async () => {
    app = await createApiTestApp();
    prisma = app.get(PrismaService);
    session = await devSignIn(app);
  });

  afterAll(() => app.close());

  it('requires an access token', async () => {
    await request(app.getHttpServer()).get('/v1/matches').expect(401);
  });

  describe('GET /v1/matches', () => {
    it('orders by kickoff and walks every page exactly once, even with equal kickoffs', async () => {
      const world = await createFixtureWorld(prisma);
      const kickoff = '2030-01-01T20:00:00Z';
      const created = [
        await world.createMatch(kickoff),
        await world.createMatch(kickoff),
        await world.createMatch(kickoff),
        await world.createMatch('2030-01-02T20:00:00Z'),
        await world.createMatch('2029-12-31T20:00:00Z'),
      ];

      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const query = `competitionId=${world.competition.id}&limit=2${cursor ? `&cursor=${cursor}` : ''}`;
        const result: MatchPage = await page(query);
        expect(result.items.length).toBeLessThanOrEqual(2);
        seen.push(...result.items.map((match) => match.id));
        cursor = result.nextCursor;
      } while (cursor);

      expect(seen).toHaveLength(created.length);
      expect(new Set(seen).size).toBe(created.length);
      expect(seen[0]).toBe(created[4]?.id);
      expect(seen[4]).toBe(created[3]?.id);
    });

    it('filters by date range and status', async () => {
      const world = await createFixtureWorld(prisma);
      await world.createMatch('2031-01-01T20:00:00Z');
      const inside = await world.createMatch('2031-01-05T20:00:00Z');
      await world.createMatch('2031-01-05T21:00:00Z', 'POSTPONED');
      await world.createMatch('2031-01-09T20:00:00Z');

      const result = await page(
        `competitionId=${world.competition.id}&from=2031-01-04T00:00:00Z&to=2031-01-06T00:00:00Z&status=SCHEDULED`,
      );

      expect(result.items.map((match) => match.id)).toEqual([inside.id]);
    });

    it('computes predictable on the server', async () => {
      const world = await createFixtureWorld(prisma);
      await world.createMatch('2020-01-01T20:00:00Z');
      await world.createMatch('2032-01-01T20:00:00Z', 'POSTPONED');
      await world.createMatch('2032-01-02T20:00:00Z');

      const result = await page(`competitionId=${world.competition.id}`);

      expect(result.items.map((match) => match.predictable)).toEqual([false, false, true]);
    });

    it('answers 400 for a tampered cursor', async () => {
      const res = await get('/v1/matches?cursor=not-a-cursor').expect(400);
      expect(res.body).toMatchObject({ code: 'INVALID_CURSOR' });
    });

    it('validates the query', async () => {
      const res = await get('/v1/matches?status=NOPE&from=yesterday').expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });

  describe('language', () => {
    it('uses Accept-Language, then falls back to English for a missing translation', async () => {
      const world = await createFixtureWorld(prisma);
      await world.createMatch('2033-01-01T20:00:00Z');

      const res = await get(`/v1/matches?competitionId=${world.competition.id}`)
        .set('Accept-Language', 'ar-EG')
        .expect(200);

      const [match] = (res.body as MatchPage).items;
      expect(match?.homeTeam.name).toBe('ليفربول');
      expect(match?.awayTeam.name).toBe('Everton');
    });

    it('uses the profile language without the header', async () => {
      const world = await createFixtureWorld(prisma);
      await world.createMatch('2033-02-01T20:00:00Z');
      const english = await devSignIn(app);
      await request(app.getHttpServer())
        .patch('/v1/me')
        .set(...bearer(english))
        .send({ locale: 'en' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/v1/matches?competitionId=${world.competition.id}`)
        .set(...bearer(english))
        .expect(200);

      expect((res.body as MatchPage).items[0]?.homeTeam.name).toBe('Liverpool');
    });
  });

  it('GET /v1/competitions lists active competitions only', async () => {
    const active = await createFixtureWorld(prisma);
    const inactive = await createFixtureWorld(prisma);
    await prisma.competition.update({ where: { id: inactive.competition.id }, data: { isActive: false } });

    const res = await get('/v1/competitions').set('Accept-Language', 'ar').expect(200);

    const items = res.body.items as { id: string; name: string }[];
    expect(items.find((item) => item.id === active.competition.id)?.name).toBe('دوري الاختبار');
    expect(items.some((item) => item.id === inactive.competition.id)).toBe(false);
  });

  describe('GET /v1/matches/:id', () => {
    it('returns the detail with the server time and the score', async () => {
      const world = await createFixtureWorld(prisma);
      const match = await world.createMatch('2026-01-01T20:00:00Z', 'FINISHED');
      await prisma.match.update({
        where: { id: match.id },
        data: {
          homeScore: 1,
          awayScore: 1,
          decidedBy: 'PENALTIES',
          homePenalties: 4,
          awayPenalties: 3,
          endedAt: new Date('2026-01-01T22:30:00Z'),
        },
      });

      const res = await get(`/v1/matches/${match.id}`).expect(200);

      expect(res.body).toMatchObject({
        id: match.id,
        status: 'FINISHED',
        predictable: false,
        score: { home: 1, away: 1, decidedBy: 'PENALTIES', penalties: { home: 4, away: 3 } },
        endedAt: '2026-01-01T22:30:00.000Z',
      });
      expect(Date.parse(String(res.body.serverTime))).not.toBeNaN();
    });

    it('answers 404 for an unknown match', async () => {
      const res = await get(`/v1/matches/${randomUUID()}`).expect(404);
      expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('GET /v1/matches/:id/squads', () => {
    it('lists the players in the requested language', async () => {
      const world = await createFixtureWorld(prisma);
      const match = await world.createMatch('2034-01-01T20:00:00Z');
      const player = await prisma.player.create({
        data: { id: randomUUID(), names: { en: 'Mohamed Salah', ar: 'محمد صلاح' } },
      });
      await prisma.matchSquadPlayer.create({
        data: { matchId: match.id, playerId: player.id, teamId: world.home.id, role: 'STARTER', shirtNumber: 11 },
      });

      const res = await get(`/v1/matches/${match.id}/squads`).set('Accept-Language', 'ar').expect(200);

      expect(res.body).toEqual({
        items: [{ playerId: player.id, name: 'محمد صلاح', teamId: world.home.id, role: 'STARTER', shirtNumber: 11 }],
      });
    });

    it('answers 404 for an unknown match', async () => {
      await get(`/v1/matches/${randomUUID()}/squads`).expect(404);
    });
  });
});
