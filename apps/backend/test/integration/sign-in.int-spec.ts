import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AuthModule } from '../../src/modules/auth';
import { SignInService } from '../../src/modules/auth/application/sign-in.service';
import type { VerifiedIdentity } from '../../src/modules/auth/application/verified-identity';
import { AccountDisabledError } from '../../src/modules/auth/domain/auth-errors';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { testConfig } from '../support/test-app';

describe('sign in with a verified identity', () => {
  let moduleRef: TestingModule;
  let signIn: SignInService;
  let prisma: PrismaService;

  const google = (overrides: Partial<VerifiedIdentity> = {}): VerifiedIdentity => ({
    provider: 'GOOGLE',
    subject: `sub-${randomUUID()}`,
    email: 'fan@example.com',
    emailVerified: true,
    displayName: 'Football Fan',
    ...overrides,
  });

  beforeAll(async () => {
    const config = testConfig();
    moduleRef = await Test.createTestingModule({
      imports: [CoreModule.register(config), AuthModule.register(config)],
    }).compile();
    await moduleRef.init();
    signIn = moduleRef.get(SignInService);
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(() => moduleRef.close());

  it('creates the user, profile, identity and first session on the first sign-in', async () => {
    const result = await signIn.signIn(google(), { platform: 'android' });

    expect(result.isNewUser).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: result.userId },
      include: { profile: true, privacySettings: true, authIdentities: true, sessions: true },
    });
    expect(user.profile?.displayName).toBe('Football Fan');
    expect(user.privacySettings).not.toBeNull();
    expect(user.authIdentities).toHaveLength(1);
    expect(user.sessions).toEqual([expect.objectContaining({ id: result.session.sessionId, platform: 'android' })]);
    expect(Buffer.from(user.sessions[0].refreshTokenHash).toString()).not.toContain(result.session.refreshToken);
  });

  it('signs the same account into the same user and opens another session', async () => {
    const identity = google();
    const first = await signIn.signIn(identity, {});
    const second = await signIn.signIn({ ...identity, displayName: 'Renamed On Google' }, {});

    expect(second).toMatchObject({ userId: first.userId, isNewUser: false });
    expect(await prisma.session.count({ where: { userId: first.userId } })).toBe(2);
    const stored = await prisma.authIdentity.findFirstOrThrow({ where: { userId: first.userId } });
    expect(stored.displayName).toBe('Renamed On Google');
  });

  it('never creates two users when the first sign-ins race', async () => {
    const identity = google();
    const results = await Promise.all(Array.from({ length: 5 }, () => signIn.signIn(identity, {})));

    expect(new Set(results.map((r) => r.userId)).size).toBe(1);
    expect(results.filter((r) => r.isNewUser)).toHaveLength(1);
    expect(await prisma.authIdentity.count({ where: { providerSubject: identity.subject } })).toBe(1);
    expect(
      await prisma.user.count({ where: { profile: { displayName: 'Football Fan' }, authIdentities: { none: {} } } }),
    ).toBe(0);
  });

  it('refuses a suspended account', async () => {
    const identity = google();
    const { userId } = await signIn.signIn(identity, {});
    await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });

    await expect(signIn.signIn(identity, {})).rejects.toBeInstanceOf(AccountDisabledError);
  });
});
