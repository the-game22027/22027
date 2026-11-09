import { exportJWK, type JWTPayload, SignJWT } from 'jose';
import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { loadConfig } from '@shared/infrastructure/config';
import { FixedClock } from '@shared/kernel';
import { ProviderTokenInvalidError } from '../domain/auth-errors';
import { JoseGoogleTokenVerifier } from './jose-google-token-verifier';

const google = generateKeyPairSync('rsa', { modulusLength: 2048 });
const now = Math.floor(Date.parse('2026-11-08T12:00:00Z') / 1000);

function idToken(claims: JWTPayload = {}, key: KeyObject = google.privateKey): Promise<string> {
  const { iss = 'https://accounts.google.com', aud = 'android-client', ...rest } = claims;
  return new SignJWT({ email: 'salah@example.com', email_verified: true, name: 'Mo Salah', ...rest })
    .setProtectedHeader({ alg: 'RS256', kid: 'g1' })
    .setIssuer(iss)
    .setAudience(aud)
    .setSubject('google-sub-1')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
}

describe('JoseGoogleTokenVerifier', () => {
  let server: Server;
  let jwksUrl: string;

  beforeAll(async () => {
    const jwk = { ...(await exportJWK(google.publicKey)), kid: 'g1', alg: 'RS256', use: 'sig' };
    server = createServer((_req, res) => res.end(JSON.stringify({ keys: [jwk] })));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    jwksUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/certs`;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  const verifier = (env: Record<string, string> = {}, clock = new FixedClock('2026-11-08T12:00:00Z')) =>
    new JoseGoogleTokenVerifier(
      loadConfig({
        DATABASE_URL: 'postgresql://game:game@localhost:5440/app',
        REDIS_URL: 'redis://localhost:6379',
        JWT_PRIVATE_KEY: generateKeyPairSync('ec', { namedCurve: 'P-256' })
          .privateKey.export({ type: 'pkcs8', format: 'pem' })
          .toString(),
        JWT_KEY_ID: 'k1',
        GOOGLE_CLIENT_IDS: 'android-client,ios-client',
        GOOGLE_JWKS_URL: jwksUrl,
        ...env,
      }),
      clock,
    );

  it('returns the Google subject and profile hints for a valid token', async () => {
    await expect(verifier().verify(await idToken())).resolves.toEqual({
      provider: 'GOOGLE',
      subject: 'google-sub-1',
      email: 'salah@example.com',
      emailVerified: true,
      displayName: 'Mo Salah',
    });
  });

  it('rejects a token issued for another app', async () => {
    await expect(verifier().verify(await idToken({ aud: 'someone-elses-app' }))).rejects.toBeInstanceOf(
      ProviderTokenInvalidError,
    );
  });

  it('rejects a token from another issuer', async () => {
    await expect(verifier().verify(await idToken({ iss: 'https://evil.example.com' }))).rejects.toBeInstanceOf(
      ProviderTokenInvalidError,
    );
  });

  it('rejects an expired token', async () => {
    const later = new FixedClock('2026-11-08T14:00:00Z');
    await expect(verifier({}, later).verify(await idToken())).rejects.toBeInstanceOf(ProviderTokenInvalidError);
  });

  it('rejects a token signed by a key Google never published', async () => {
    const forger = generateKeyPairSync('rsa', { modulusLength: 2048 });
    await expect(verifier().verify(await idToken({}, forger.privateKey))).rejects.toBeInstanceOf(
      ProviderTokenInvalidError,
    );
  });

  it('accepts nothing when no client ids are configured', async () => {
    await expect(verifier({ GOOGLE_CLIENT_IDS: '' }).verify(await idToken())).rejects.toBeInstanceOf(
      ProviderTokenInvalidError,
    );
  });
});
