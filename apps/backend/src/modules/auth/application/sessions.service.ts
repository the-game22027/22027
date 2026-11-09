import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CLOCK, type Clock } from '@shared/kernel';
import { SessionNotFoundError } from '../domain/auth-errors';
import type { AuthContext } from './ports/access-tokens';
import { type ActiveSession, SESSION_REPOSITORY, type SessionRepository } from './ports/session-repository';

export interface SessionView extends ActiveSession {
  readonly current: boolean;
}

@Injectable()
export class SessionsService {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(auth: AuthContext): Promise<SessionView[]> {
    const [own, active] = await Promise.all([
      this.sessions.findOwned(auth.sessionId, auth.userId),
      this.sessions.findActiveForUser(auth.userId, this.clock.now()),
    ]);
    return active.map((session) => ({ ...session, current: session.familyId === own?.familyId }));
  }

  // Revokes the family, not the row: refreshing replaces the row, so the id in an access token or in an
  // already-fetched list can point at a rotated one.
  @Transactional()
  async logout(auth: AuthContext): Promise<void> {
    const own = await this.sessions.findOwned(auth.sessionId, auth.userId);
    if (own) await this.sessions.revokeFamily(own.familyId, 'LOGOUT', this.clock.now());
  }

  @Transactional()
  async revoke(auth: AuthContext, sessionId: string): Promise<void> {
    const target = await this.sessions.findOwned(sessionId, auth.userId);
    if (!target) throw new SessionNotFoundError();
    await this.sessions.revokeFamily(target.familyId, 'REVOKED_BY_USER', this.clock.now());
  }
}
