import { Inject, Injectable } from '@nestjs/common';
import { AppConfig } from '@shared/infrastructure/config';
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from '@shared/kernel';
import { absoluteExpiry, slidingExpiry } from '../domain/refresh-policy';
import { ACCESS_TOKENS, type AccessTokens } from './ports/access-tokens';
import { type DeviceInfo, SESSION_REPOSITORY, type SessionRepository } from './ports/session-repository';
import { generateRefreshToken } from './refresh-token';

export interface IssuedSession {
  readonly sessionId: string;
  readonly accessToken: string;
  readonly accessTokenExpiresAt: Date;
  readonly refreshToken: string;
}

export interface SessionFamily {
  readonly id: string;
  readonly absoluteExpiresAt: Date;
}

@Injectable()
export class SessionIssuer {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(ACCESS_TOKENS) private readonly accessTokens: AccessTokens,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly config: AppConfig,
  ) {}

  async start(userId: string, device: DeviceInfo, family?: SessionFamily): Promise<IssuedSession> {
    const now = this.clock.now();
    const { slidingDays, absoluteDays } = this.config.refreshToken;
    const absoluteExpiresAt = family?.absoluteExpiresAt ?? absoluteExpiry(now, absoluteDays);
    const refresh = generateRefreshToken();
    const sessionId = this.ids.next();
    await this.sessions.create({
      id: sessionId,
      userId,
      familyId: family?.id ?? this.ids.next(),
      refreshTokenHash: refresh.hash,
      device,
      now,
      expiresAt: slidingExpiry(now, slidingDays, absoluteExpiresAt),
      absoluteExpiresAt,
    });
    const access = await this.accessTokens.issue({ userId, sessionId });
    return {
      sessionId,
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: refresh.token,
    };
  }
}
