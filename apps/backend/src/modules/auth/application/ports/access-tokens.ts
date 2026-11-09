export interface AccessTokenClaims {
  readonly userId: string;
  readonly sessionId: string;
}

export interface IssuedAccessToken {
  readonly token: string;
  readonly expiresAt: Date;
}

export interface AccessTokens {
  issue(claims: AccessTokenClaims): Promise<IssuedAccessToken>;
  verify(token: string): Promise<AccessTokenClaims>;
}

export const ACCESS_TOKENS = Symbol('ACCESS_TOKENS');
