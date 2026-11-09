import { createHash, randomBytes } from 'node:crypto';

// 256 random bits cannot be guessed, so a fast hash is safe here (passwords would need bcrypt).
const TOKEN_BYTES = 32;

export interface NewRefreshToken {
  readonly token: string;
  readonly hash: Uint8Array<ArrayBuffer>;
}

export function generateRefreshToken(): NewRefreshToken {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): Uint8Array<ArrayBuffer> {
  return createHash('sha256').update(token, 'utf8').digest();
}
