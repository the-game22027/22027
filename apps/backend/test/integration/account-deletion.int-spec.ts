import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AuthModule } from '../../src/modules/auth';
import { AccountDeletionService } from '../../src/modules/auth/application/account-deletion.service';
import { RefreshSessionService } from '../../src/modules/auth/application/refresh-session.service';
import { SignInService } from '../../src/modules/auth/application/sign-in.service';
import {
  InvalidAccessTokenError,
  RecentSignInRequiredError,
  RefreshTokenInvalidError,
} from '../../src/modules/auth/domain/auth-errors';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { CLOCK, FixedClock } from '../../src/shared/kernel';
import { testConfig } from '../support/test-app';

describe('account deletion request', () => {
  let moduleRef: TestingModule;
  let signIn: SignInService;
  let refresh: RefreshSessionService;
  let deletion: AccountDeletionService;
  let prisma: PrismaService;
  const clock = new FixedClock('2026-11-09T12:00:00Z');

  const identity = () => ({
    provider: 'GOOGLE' as const,
    subject: `sub-${randomUUID()}`,
    email: null,
    emailVerified: false,
  });
  const authOf = (result: { userId: string; session: { sessionId: string } }) => ({
    userId: result.userId,
    sessionId: result.session.sessionId,
  });
  const eventsFor = (userId: string) =>
    prisma.outboxEvent.findMany({ where: { aggregateId: userId }, orderBy: { id: 'asc' } });

  beforeAll(async () => {
    const config = testConfig({ ACCOUNT_DELETION_RECENT_SIGN_IN_SECONDS: '600' });
    moduleRef = await Test.createTestingModule({ imports: [CoreModule.register(config), AuthModule.register(config)] })
      .overrideProvider(CLOCK)
      .useValue(clock)
      .compile();
    await moduleRef.init();
    signIn = moduleRef.get(SignInService);
    refresh = moduleRef.get(RefreshSessionService);
    deletion = moduleRef.get(AccountDeletionService);
    prisma = moduleRef.get(PrismaService);
  });

  beforeEach(() => clock.set('2026-11-09T12:00:00Z'));

  afterAll(() => moduleRef.close());

  it('marks the account, signs out every device and writes the event', async () => {
    const who = identity();
    const phone = await signIn.signIn(who, {});
    const tablet = await signIn.signIn(who, {});

    await deletion.request(authOf(phone));

    const user = await prisma.user.findUniqueOrThrow({ where: { id: phone.userId } });
    expect(user.status).toBe('PENDING_DELETION');
    expect(user.deletedAt).toEqual(clock.now());
    await expect(refresh.refresh(tablet.session.refreshToken, {})).rejects.toBeInstanceOf(RefreshTokenInvalidError);
    expect(await eventsFor(phone.userId)).toEqual([
      expect.objectContaining({ type: 'UserDeletionRequested', payload: { userId: phone.userId } }),
    ]);
  });

  it('signing in during the grace period cancels the deletion', async () => {
    const who = identity();
    const first = await signIn.signIn(who, {});
    await deletion.request(authOf(first));

    const again = await signIn.signIn(who, {});

    expect(again).toMatchObject({ userId: first.userId, isNewUser: false });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: first.userId } });
    expect(user).toMatchObject({ status: 'ACTIVE', deletedAt: null });
    expect((await eventsFor(first.userId)).map((event) => event.type)).toEqual([
      'UserDeletionRequested',
      'UserDeletionCancelled',
    ]);
  });

  it('refuses when the sign-in is old, even after a fresh token refresh', async () => {
    const first = await signIn.signIn(identity(), {});
    clock.set('2026-11-09T12:10:01Z');
    const refreshed = await refresh.refresh(first.session.refreshToken, {});

    await expect(deletion.request(authOf(refreshed))).rejects.toBeInstanceOf(RecentSignInRequiredError);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: first.userId } });
    expect(user.status).toBe('ACTIVE');
  });

  it('refuses a token whose session was revoked', async () => {
    const first = await signIn.signIn(identity(), {});
    await prisma.session.updateMany({ where: { userId: first.userId }, data: { revokedAt: clock.now() } });

    await expect(deletion.request(authOf(first))).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('accepts a token from before the last refresh', async () => {
    const first = await signIn.signIn(identity(), {});
    await refresh.refresh(first.session.refreshToken, {});

    await expect(deletion.request(authOf(first))).resolves.toBeUndefined();
  });
});
