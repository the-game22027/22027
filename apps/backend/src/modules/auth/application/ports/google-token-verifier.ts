import type { VerifiedIdentity } from '../verified-identity';

export interface GoogleTokenVerifier {
  /** @throws ProviderTokenInvalidError */
  verify(idToken: string): Promise<VerifiedIdentity>;
}

export const GOOGLE_TOKEN_VERIFIER = Symbol('GOOGLE_TOKEN_VERIFIER');
