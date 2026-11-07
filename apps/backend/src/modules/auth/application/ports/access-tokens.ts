/** Who is calling, as proven by a valid access token. */
export interface AccessTokenClaims {
  readonly userId: string;
  readonly sessionId: string;
}

export interface IssuedAccessToken {
  readonly token: string;
  readonly expiresAt: Date;
}

/**
 * Signs and verifies short-lived access tokens (04-auth.md §5). A port so use cases stay free of the
 * JWT library and tests can control time through the injected Clock.
 */
export interface AccessTokens {
  issue(claims: AccessTokenClaims): Promise<IssuedAccessToken>;
  /** @throws InvalidAccessTokenError, AccessTokenExpiredError */
  verify(token: string): Promise<AccessTokenClaims>;
}

export const ACCESS_TOKENS = Symbol('ACCESS_TOKENS');
