import { createHash, randomBytes } from 'node:crypto';

/** 256 random bits: unguessable, so a fast hash is enough to protect it at rest (no bcrypt needed). */
const TOKEN_BYTES = 32;

export interface NewRefreshToken {
  /** Sent to the client once, never stored. */
  readonly token: string;
  /** Stored in `sessions.refresh_token_hash`. */
  readonly hash: Uint8Array<ArrayBuffer>;
}

/** Opaque refresh token (04-auth.md §5): random, URL-safe, meaningless to the client. */
export function generateRefreshToken(): NewRefreshToken {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, hash: hashRefreshToken(token) };
}

/** SHA-256 of the token: how a presented token is looked up without ever storing it. */
export function hashRefreshToken(token: string): Uint8Array<ArrayBuffer> {
  return createHash('sha256').update(token, 'utf8').digest();
}
