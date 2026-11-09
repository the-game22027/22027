import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { UsersFacade } from '@modules/users';
import { AppConfig } from '@shared/infrastructure/config';
import { CLOCK, type Clock } from '@shared/kernel';
import { InvalidAccessTokenError, RecentSignInRequiredError } from '../domain/auth-errors';
import { isRecentSignIn } from '../domain/recent-sign-in';
import type { AuthContext } from './ports/access-tokens';
import { SESSION_REPOSITORY, type SessionRepository } from './ports/session-repository';

@Injectable()
export class AccountDeletionService {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    private readonly users: UsersFacade,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly config: AppConfig,
  ) {}

  @Transactional()
  async request(auth: AuthContext): Promise<void> {
    const now = this.clock.now();
    // An access token outlives its revocation by up to its TTL, and refreshing renews it silently,
    // so this checks the session itself and when its owner last really signed in.
    const family = await this.sessions.findFamilyState(auth.sessionId, now);
    if (family?.userId !== auth.userId || !family.active) throw new InvalidAccessTokenError();
    if (!isRecentSignIn(family.signedInAt, now, this.config.accountDeletion.recentSignInSeconds)) {
      throw new RecentSignInRequiredError();
    }

    await this.users.requestDeletion(auth.userId);
    await this.sessions.revokeAllForUser(auth.userId, 'ACCOUNT_DISABLED', now);
  }
}
