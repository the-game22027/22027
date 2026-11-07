import { generateRefreshToken, hashRefreshToken } from './refresh-token';

describe('refresh tokens', () => {
  it('are 256-bit, URL-safe and different every time', () => {
    const tokens = Array.from({ length: 100 }, () => generateRefreshToken().token);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes in base64url
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it('store a SHA-256 hash that the same token always reproduces', () => {
    const { token, hash } = generateRefreshToken();
    expect(hash).toHaveLength(32);
    expect(Buffer.from(hashRefreshToken(token)).equals(Buffer.from(hash))).toBe(true);
    expect(Buffer.from(hashRefreshToken(`${token}x`)).equals(Buffer.from(hash))).toBe(false);
    expect(Buffer.from(hash).toString('base64url')).not.toContain(token);
  });
});
