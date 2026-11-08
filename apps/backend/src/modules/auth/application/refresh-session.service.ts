import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { UsersFacade } from '@modules/users';
import { CLOCK, type Clock } from '@shared/kernel';
import { AccountDisabledError, RefreshTokenInvalidError, RefreshTokenReusedError } from '../domain/auth-errors';
import { assessRefresh } from '../domain/refresh-policy';
import { type DeviceInfo, SESSION_REPOSITORY, type SessionRepository } from './ports/session-repository';
import { hashRefreshToken } from './refresh-token';
import { type IssuedSession, SessionIssuer } from './session-issuer';

export interface RefreshResult {
  readonly userId: string;
  readonly session: IssuedSession;
}

type Outcome = ({ kind: 'ROTATED' } & RefreshResult) | { kind: 'INVALID' | 'REUSED' | 'DISABLED' };

@Injectable()
export class RefreshSessionService {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    private readonly issuer: SessionIssuer,
    private readonly users: UsersFacade,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async refresh(refreshToken: string, requestDevice: Pick<DeviceInfo, 'userAgent' | 'ip'>): Promise<RefreshResult> {
    // Throw only after the transaction commits: a family revoked for reuse must stay revoked.
    const outcome = await this.rotate(refreshToken, requestDevice);
    switch (outcome.kind) {
      case 'ROTATED':
        return outcome;
      case 'REUSED':
        throw new RefreshTokenReusedError();
      case 'DISABLED':
        throw new AccountDisabledError();
      case 'INVALID':
        throw new RefreshTokenInvalidError();
    }
  }

  @Transactional()
  private async rotate(refreshToken: string, requestDevice: Pick<DeviceInfo, 'userAgent' | 'ip'>): Promise<Outcome> {
    const current = await this.sessions.findByTokenHashForUpdate(hashRefreshToken(refreshToken));
    if (!current) return { kind: 'INVALID' };

    const now = this.clock.now();
    const verdict = assessRefresh(current, now);
    if (verdict === 'REUSED') {
      await this.sessions.revokeFamily(current.familyId, 'REUSE_DETECTED', now);
      return { kind: 'REUSED' };
    }
    if (verdict !== 'ACTIVE') return { kind: 'INVALID' };

    const account = await this.users.getAccount(current.userId);
    if (account?.status !== 'ACTIVE') {
      await this.sessions.revokeFamily(current.familyId, 'ACCOUNT_DISABLED', now);
      return { kind: 'DISABLED' };
    }

    const session = await this.issuer.start(
      current.userId,
      {
        ...requestDevice,
        ...(current.platform ? { platform: current.platform } : {}),
        ...(current.deviceName ? { deviceName: current.deviceName } : {}),
      },
      { id: current.familyId, absoluteExpiresAt: current.absoluteExpiresAt },
    );
    await this.sessions.markRotated(current.id, session.sessionId, now);
    return { kind: 'ROTATED', userId: current.userId, session };
  }
}
