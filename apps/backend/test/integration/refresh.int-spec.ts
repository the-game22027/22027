import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AuthModule } from '../../src/modules/auth';
import { RefreshSessionService } from '../../src/modules/auth/application/refresh-session.service';
import { SignInService } from '../../src/modules/auth/application/sign-in.service';
import {
  AccountDisabledError,
  RefreshTokenInvalidError,
  RefreshTokenReusedError,
} from '../../src/modules/auth/domain/auth-errors';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { CLOCK, FixedClock } from '../../src/shared/kernel';
import { testConfig } from '../support/test-app';

const DAY = 24 * 60 * 60 * 1000;

describe('refresh token rotation', () => {
  let moduleRef: TestingModule;
  let signIn: SignInService;
  let refresh: RefreshSessionService;
  let prisma: PrismaService;
  const clock = new FixedClock('2026-11-08T12:00:00Z');

  const newSignIn = () =>
    signIn.signIn(
      { provider: 'GOOGLE', subject: `sub-${randomUUID()}`, email: null, emailVerified: false },
      { platform: 'ios', deviceName: 'iPhone' },
    );

  const familyOf = async (sessionId: string) => {
    const { familyId } = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    return prisma.session.findMany({ where: { familyId }, orderBy: { createdAt: 'asc' } });
  };

  beforeAll(async () => {
    const config = testConfig();
    moduleRef = await Test.createTestingModule({ imports: [CoreModule.register(config), AuthModule.register(config)] })
      .overrideProvider(CLOCK)
      .useValue(clock)
      .compile();
    await moduleRef.init();
    signIn = moduleRef.get(SignInService);
    refresh = moduleRef.get(RefreshSessionService);
    prisma = moduleRef.get(PrismaService);
  });

  beforeEach(() => clock.set('2026-11-08T12:00:00Z'));

  afterAll(() => moduleRef.close());

  it('replaces the session with a new one in the same family and keeps the device', async () => {
    const { session } = await newSignIn();
    clock.advanceBy(DAY);
    const next = await refresh.refresh(session.refreshToken, { userAgent: 'app/2.0' });

    expect(next.session.refreshToken).not.toBe(session.refreshToken);
    const [old, current] = await familyOf(session.sessionId);
    expect(old).toMatchObject({ revokeReason: 'ROTATED', replacedBySessionId: next.session.sessionId });
    expect(current).toMatchObject({ revokedAt: null, platform: 'ios', deviceName: 'iPhone', userAgent: 'app/2.0' });
    expect(current.absoluteExpiresAt).toEqual(old.absoluteExpiresAt);
  });

  it('revokes the whole family when a rotated token comes back', async () => {
    const { session } = await newSignIn();
    const next = await refresh.refresh(session.refreshToken, {});

    await expect(refresh.refresh(session.refreshToken, {})).rejects.toBeInstanceOf(RefreshTokenReusedError);
    await expect(refresh.refresh(next.session.refreshToken, {})).rejects.toBeInstanceOf(RefreshTokenInvalidError);
    const family = await familyOf(session.sessionId);
    expect(family.every((s) => s.revokedAt !== null)).toBe(true);
    expect(family[1].revokeReason).toBe('REUSE_DETECTED');
  });

  it('lets only one of two concurrent refreshes with the same token win', async () => {
    const { session } = await newSignIn();
    const results = await Promise.allSettled([
      refresh.refresh(session.refreshToken, {}),
      refresh.refresh(session.refreshToken, {}),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(RefreshTokenReusedError);
  });

  it('expires after the sliding window without use', async () => {
    const { session } = await newSignIn();
    clock.advanceBy(61 * DAY);
    await expect(refresh.refresh(session.refreshToken, {})).rejects.toBeInstanceOf(RefreshTokenInvalidError);
  });

  it('never outlives the absolute limit, however often it is refreshed', async () => {
    let { session } = await newSignIn();
    for (const day of [50, 100, 150, 179]) {
      clock.set(new Date(Date.parse('2026-11-08T12:00:00Z') + day * DAY));
      ({ session } = await refresh.refresh(session.refreshToken, {}));
    }
    const latest = await prisma.session.findUniqueOrThrow({ where: { id: session.sessionId } });
    expect(latest.expiresAt).toEqual(latest.absoluteExpiresAt);

    clock.set(new Date(Date.parse('2026-11-08T12:00:00Z') + 180 * DAY));
    await expect(refresh.refresh(session.refreshToken, {})).rejects.toBeInstanceOf(RefreshTokenInvalidError);
  });

  it('refuses unknown tokens and suspended accounts', async () => {
    await expect(refresh.refresh('made-up-token', {})).rejects.toBeInstanceOf(RefreshTokenInvalidError);

    const { userId, session } = await newSignIn();
    await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
    await expect(refresh.refresh(session.refreshToken, {})).rejects.toBeInstanceOf(AccountDisabledError);
    expect((await familyOf(session.sessionId))[0]).toMatchObject({ revokeReason: 'ACCOUNT_DISABLED' });
  });
});
