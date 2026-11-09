import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { UsersFacade } from '@modules/users';
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from '@shared/kernel';
import { AccountDisabledError } from '../domain/auth-errors';
import { IDENTITY_REPOSITORY, type IdentityRepository } from './ports/identity-repository';
import type { DeviceInfo } from './ports/session-repository';
import { type IssuedSession, SessionIssuer } from './session-issuer';
import type { VerifiedIdentity } from './verified-identity';

export interface SignInResult {
  readonly userId: string;
  readonly isNewUser: boolean;
  readonly session: IssuedSession;
}

class LostFirstSignInRace extends Error {}

@Injectable()
export class SignInService {
  constructor(
    @Inject(IDENTITY_REPOSITORY) private readonly identities: IdentityRepository,
    private readonly users: UsersFacade,
    private readonly sessions: SessionIssuer,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async signIn(identity: VerifiedIdentity, device: DeviceInfo): Promise<SignInResult> {
    try {
      return await this.attempt(identity, device);
    } catch (error) {
      // Two first sign-ins with the same account (double tap, two devices): the loser's transaction
      // rolled back, and retrying finds the identity the winner created.
      if (error instanceof LostFirstSignInRace) return this.attempt(identity, device);
      throw error;
    }
  }

  @Transactional()
  private async attempt(identity: VerifiedIdentity, device: DeviceInfo): Promise<SignInResult> {
    const now = this.clock.now();
    const profile = {
      email: identity.email,
      emailVerified: identity.emailVerified,
      displayName: identity.displayName ?? null,
    };

    const existing = await this.identities.findBySubject(identity.provider, identity.subject);
    if (existing) {
      const account = await this.users.getAccount(existing.userId);
      if (account?.status !== 'ACTIVE') throw new AccountDisabledError();
      await this.identities.recordUse(existing.id, profile, now);
      return { userId: existing.userId, isNewUser: false, session: await this.sessions.start(existing.userId, device) };
    }

    const userId = await this.users.createFromIdentity({
      ...(identity.displayName ? { displayName: identity.displayName } : {}),
      ...(identity.avatarUrl ? { avatarUrl: identity.avatarUrl } : {}),
    });
    const created = await this.identities.create({
      id: this.ids.next(),
      userId,
      provider: identity.provider,
      subject: identity.subject,
      ...profile,
      now,
    });
    if (!created) throw new LostFirstSignInRace();
    return { userId, isNewUser: true, session: await this.sessions.start(userId, device) };
  }
}
