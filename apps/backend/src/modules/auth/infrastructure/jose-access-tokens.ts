import { Inject, Injectable } from '@nestjs/common';
import { errors, jwtVerify, SignJWT, type JWTHeaderParameters } from 'jose';
import { createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto';
import { AppConfig } from '@shared/infrastructure/config';
import { CLOCK, type Clock } from '@shared/kernel';
import type { AccessTokenClaims, AccessTokens, IssuedAccessToken } from '../application/ports/access-tokens';
import { AccessTokenExpiredError, InvalidAccessTokenError } from '../domain/auth-errors';

const ALGORITHM = 'ES256';

/**
 * ES256 JWTs with a `kid` header. Tokens carry only `sub` (user id) and `sid` (session id); everything
 * else is looked up server-side. The previous public key stays valid during a rotation.
 */
@Injectable()
export class JoseAccessTokens implements AccessTokens {
  private readonly signingKey: KeyObject;
  private readonly verificationKeys: ReadonlyMap<string, KeyObject>;

  constructor(
    private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    const { privateKeyPem, keyId, previous } = config.jwt;
    this.signingKey = createPrivateKey(privateKeyPem);
    const keys = new Map([[keyId, createPublicKey(this.signingKey)]]);
    if (previous) keys.set(previous.keyId, createPublicKey(previous.publicKeyPem));
    this.verificationKeys = keys;
  }

  async issue({ userId, sessionId }: AccessTokenClaims): Promise<IssuedAccessToken> {
    const { keyId, issuer, audience, accessTokenTtlSeconds } = this.config.jwt;
    const issuedAt = Math.floor(this.clock.now().getTime() / 1000);
    const expiresAt = issuedAt + accessTokenTtlSeconds;
    const token = await new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: ALGORITHM, kid: keyId, typ: 'JWT' })
      .setSubject(userId)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .sign(this.signingKey);
    return { token, expiresAt: new Date(expiresAt * 1000) };
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    const { issuer, audience } = this.config.jwt;
    try {
      const { payload } = await jwtVerify(token, (header: JWTHeaderParameters) => this.keyFor(header), {
        algorithms: [ALGORITHM], // never trust the token's own `alg` (rejects `none` and HS256 tricks)
        issuer,
        audience,
        requiredClaims: ['sub', 'sid', 'iat', 'exp'],
        currentDate: this.clock.now(),
      });
      if (typeof payload.sub !== 'string' || typeof payload['sid'] !== 'string') {
        throw new InvalidAccessTokenError();
      }
      return { userId: payload.sub, sessionId: payload['sid'] };
    } catch (error) {
      if (error instanceof errors.JWTExpired) throw new AccessTokenExpiredError();
      if (error instanceof errors.JOSEError) throw new InvalidAccessTokenError();
      throw error;
    }
  }

  private keyFor(header: JWTHeaderParameters): KeyObject {
    const key = header.kid === undefined ? undefined : this.verificationKeys.get(header.kid);
    if (!key) throw new InvalidAccessTokenError();
    return key;
  }
}
