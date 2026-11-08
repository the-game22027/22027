import { Inject, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import { AppConfig } from '@shared/infrastructure/config';
import { CLOCK, type Clock } from '@shared/kernel';
import type { GoogleTokenVerifier } from '../application/ports/google-token-verifier';
import type { VerifiedIdentity } from '../application/verified-identity';
import { ProviderTokenInvalidError } from '../domain/auth-errors';

@Injectable()
export class JoseGoogleTokenVerifier implements GoogleTokenVerifier {
  // Caches Google's public keys and refetches when a token names an unknown kid.
  private readonly keys: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.keys = createRemoteJWKSet(new URL(config.google.jwksUrl));
  }

  async verify(idToken: string): Promise<VerifiedIdentity> {
    const { clientIds, issuers } = this.config.google;
    if (clientIds.length === 0) throw new ProviderTokenInvalidError();
    try {
      const { payload } = await jwtVerify(idToken, this.keys, {
        algorithms: ['RS256'],
        issuer: [...issuers],
        audience: [...clientIds],
        requiredClaims: ['sub', 'iat', 'exp'],
        currentDate: this.clock.now(),
      });
      if (typeof payload.sub !== 'string') throw new ProviderTokenInvalidError();
      return {
        provider: 'GOOGLE',
        subject: payload.sub,
        email: typeof payload['email'] === 'string' ? payload['email'] : null,
        emailVerified: payload['email_verified'] === true,
        ...(typeof payload['name'] === 'string' ? { displayName: payload['name'] } : {}),
        ...(typeof payload['picture'] === 'string' ? { avatarUrl: payload['picture'] } : {}),
      };
    } catch (error) {
      // Google being unreachable is our outage, not a bad token: let it surface as a 500.
      if (error instanceof errors.JWKSTimeout) throw error;
      if (error instanceof errors.JOSEError) throw new ProviderTokenInvalidError();
      throw error;
    }
  }
}
