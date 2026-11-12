import { Test, type TestingModule } from '@nestjs/testing';
import { VisiblePredictionsQuery } from '../../src/modules/predictions/application/visible-predictions.query';
import { PredictionsModule } from '../../src/modules/predictions/predictions.module';
import { SocialFacade } from '../../src/modules/social/application/social.facade';
import { SocialModule } from '../../src/modules/social';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { UuidV7Generator } from '../../src/shared/kernel';
import { createFixtureWorld } from '../support/football';
import { testConfig } from '../support/test-app';

const ids = new UuidV7Generator();
const PAST = '2020-01-01T20:00:00Z';
const FUTURE = '2040-01-01T20:00:00Z';

/** The P7 exit matrix (ROADMAP): owner, friend before/after kickoff, stranger, blocked, on every read path. */
describe('prediction visibility (DEC-21)', () => {
  let moduleRef: TestingModule;
  let visible: VisiblePredictionsQuery;
  let prisma: PrismaService;
  const players = { owner: '', friend: '', stranger: '', blocked: '' };
  const matches = { started: '', upcoming: '' };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [CoreModule.register(testConfig()), PredictionsModule, SocialModule],
    }).compile();
    await moduleRef.init();
    visible = moduleRef.get(VisiblePredictionsQuery);
    prisma = moduleRef.get(PrismaService);
    const social = moduleRef.get(SocialFacade);

    for (const name of Object.keys(players) as (keyof typeof players)[]) {
      players[name] = ids.next();
      await prisma.user.create({
        data: { id: players[name], profile: { create: { displayName: name } }, privacySettings: { create: {} } },
      });
    }
    const world = await createFixtureWorld(prisma);
    matches.started = (await world.createMatch(PAST, 'FINISHED')).id;
    matches.upcoming = (await world.createMatch(FUTURE)).id;
    for (const matchId of [matches.started, matches.upcoming]) {
      const predictionId = ids.next();
      await prisma.prediction.create({
        data: {
          id: predictionId,
          userId: players.owner,
          matchId,
          createdAt: new Date(),
          updatedAt: new Date(),
          picks: { create: { pickType: 'EXACT_SCORE', homeScore: 2, awayScore: 1 } },
        },
      });
    }

    const { request } = await social.sendFriendRequest(players.owner, players.friend);
    await social.acceptFriendRequest(request.id, players.friend);
    const { request: second } = await social.sendFriendRequest(players.owner, players.blocked);
    await social.acceptFriendRequest(second.id, players.blocked);
    await social.blockUser(players.owner, players.blocked);
  });

  afterAll(() => moduleRef.close());

  const matchIdsSeenBy = async (viewer: string) =>
    (await visible.listVisiblePredictionsOfUser(viewer, players.owner, {})).items.map((item) => item.matchId).sort();
  const ownersSeenForMatch = async (viewer: string, matchId: string) =>
    (await visible.listFriendPredictionsForMatch(viewer, matchId, {})).items.map((item) => item.user.id);

  it("a player's history: the owner sees all, a friend only past kickoff", async () => {
    expect(await matchIdsSeenBy(players.owner)).toEqual([matches.started, matches.upcoming].sort());
    expect(await matchIdsSeenBy(players.friend)).toEqual([matches.started]);
  });

  it("a player's history: a stranger and a blocked player get USER_NOT_FOUND", async () => {
    for (const viewer of [players.stranger, players.blocked]) {
      await expect(visible.listVisiblePredictionsOfUser(viewer, players.owner, {})).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
      });
    }
  });

  it("friends' predictions for a match: only friends, only after kickoff", async () => {
    expect(await ownersSeenForMatch(players.friend, matches.started)).toEqual([players.owner]);
    expect(await ownersSeenForMatch(players.friend, matches.upcoming)).toEqual([]);
    expect(await ownersSeenForMatch(players.stranger, matches.started)).toEqual([]);
    expect(await ownersSeenForMatch(players.blocked, matches.started)).toEqual([]);
  });

  it('becomes visible the moment kickoff passes by the database clock', async () => {
    await prisma.match.update({ where: { id: matches.upcoming }, data: { kickoffAt: new Date(Date.now() - 1000) } });
    expect(await ownersSeenForMatch(players.friend, matches.upcoming)).toEqual([players.owner]);
    expect(await matchIdsSeenBy(players.friend)).toEqual([matches.started, matches.upcoming].sort());
  });
});
