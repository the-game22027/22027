import { Test, type TestingModule } from '@nestjs/testing';
import { SocialModule } from '../../src/modules/social';
import { SocialFacade } from '../../src/modules/social/application/social.facade';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { UuidV7Generator } from '../../src/shared/kernel';
import { testConfig } from '../support/test-app';

const ids = new UuidV7Generator();

describe('social under concurrency', () => {
  let moduleRef: TestingModule;
  let social: SocialFacade;
  let prisma: PrismaService;

  beforeAll(async () => {
    const config = testConfig();
    moduleRef = await Test.createTestingModule({ imports: [CoreModule.register(config), SocialModule] }).compile();
    await moduleRef.init();
    social = moduleRef.get(SocialFacade);
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(() => moduleRef.close());

  const createPlayer = async (displayName = 'Player') => {
    const id = ids.next();
    await prisma.user.create({ data: { id, profile: { create: { displayName } }, privacySettings: { create: {} } } });
    return id;
  };
  const codeOf = (result: PromiseSettledResult<unknown>) =>
    result.status === 'rejected' ? (result.reason as { code?: string }).code : 'OK';

  it('lets only one of two players asking each other at once create the request', async () => {
    const [a, b] = [await createPlayer(), await createPlayer()];

    const results = await Promise.allSettled([social.sendFriendRequest(a, b), social.sendFriendRequest(b, a)]);

    expect(results.map(codeOf).sort()).toEqual(['FRIEND_REQUEST_EXISTS', 'OK']);
    expect(await prisma.friendRequest.count({ where: { status: 'PENDING', requesterId: { in: [a, b] } } })).toBe(1);
  });

  it('turns a double send into one request', async () => {
    const [a, b] = [await createPlayer(), await createPlayer()];

    const [first, second] = await Promise.all([social.sendFriendRequest(a, b), social.sendFriendRequest(a, b)]);

    expect([first.created, second.created].sort()).toEqual([false, true]);
    expect(first.request.id).toBe(second.request.id);
  });

  it('lets accept or cancel win, never both', async () => {
    const [a, b] = [await createPlayer(), await createPlayer()];
    const { request } = await social.sendFriendRequest(a, b);

    const results = await Promise.allSettled([
      social.acceptFriendRequest(request.id, b),
      social.cancelFriendRequest(request.id, a),
    ]);

    expect(results.map(codeOf).sort()).toEqual(['FRIEND_REQUEST_NOT_PENDING', 'OK']);
    const accepted = results[0].status === 'fulfilled';
    const [low, high] = [a, b].sort();
    expect(await prisma.friendship.count({ where: { userLowId: low, userHighId: high } })).toBe(accepted ? 1 : 0);
  });

  it('ends the friendship and every pending request when one player blocks the other', async () => {
    const [a, b, c] = [await createPlayer(), await createPlayer(), await createPlayer()];
    const { request } = await social.sendFriendRequest(a, b);
    await social.acceptFriendRequest(request.id, b);
    const { request: pending } = await social.sendFriendRequest(c, a);
    await social.blockUser(a, c);
    await social.blockUser(a, b);
    await social.blockUser(a, b);

    const [low, high] = [a, b].sort();
    expect(await prisma.friendship.count({ where: { userLowId: low, userHighId: high } })).toBe(0);
    expect(await prisma.friendRequest.findUnique({ where: { id: pending.id } })).toMatchObject({ status: 'CANCELLED' });
    const events = await prisma.outboxEvent.findMany({
      where: { type: { in: ['FriendshipRemoved', 'UserBlocked'] }, aggregateId: { in: [a, low] } },
      orderBy: { occurredAt: 'asc' },
    });
    expect(events.map((event) => [event.type, event.payload])).toEqual([
      ['UserBlocked', { blockerId: a, blockedId: c }],
      ['FriendshipRemoved', { userA: low, userB: high, reason: 'BLOCKED' }],
      ['UserBlocked', { blockerId: a, blockedId: b }],
    ]);
    await expect(social.sendFriendRequest(b, a)).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });
});
