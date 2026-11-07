import { SignJWT } from 'jose';
import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { loadConfig } from '@shared/infrastructure/config';
import { FixedClock } from '@shared/kernel';
import { AccessTokenExpiredError, InvalidAccessTokenError } from '../domain/auth-errors';
import { JoseAccessTokens } from './jose-access-tokens';

const newKey = () => generateKeyPairSync('ec', { namedCurve: 'P-256' });
const privatePem = (key: KeyObject) => key.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicPem = (key: KeyObject) => key.export({ type: 'spki', format: 'pem' }).toString();

const current = newKey();
const claims = { userId: '01980000-0000-7000-8000-000000000001', sessionId: '01980000-0000-7000-8000-000000000002' };

function service(clock: FixedClock, env: Record<string, string> = {}): JoseAccessTokens {
  const config = loadConfig({
    DATABASE_URL: 'postgresql://game:game@localhost:5440/app',
    REDIS_URL: 'redis://localhost:6379',
    JWT_PRIVATE_KEY: privatePem(current.privateKey),
    JWT_KEY_ID: 'k1',
    ...env,
  });
  return new JoseAccessTokens(config, clock);
}

/** A token signed outside the service, to forge headers and claims. */
function forge(key: KeyObject, kid: string, overrides: { aud?: string; alg?: string } = {}): Promise<string> {
  const now = Math.floor(Date.parse('2026-11-08T12:00:00Z') / 1000);
  return new SignJWT({ sid: claims.sessionId })
    .setProtectedHeader({ alg: overrides.alg ?? 'ES256', kid })
    .setSubject(claims.userId)
    .setIssuer('the-game-api')
    .setAudience(overrides.aud ?? 'the-game-app')
    .setIssuedAt(now)
    .setExpirationTime(now + 900)
    .sign(key);
}

describe('JoseAccessTokens', () => {
  let clock: FixedClock;
  beforeEach(() => (clock = new FixedClock('2026-11-08T12:00:00Z')));

  it('issues a token that verifies back to the same user and session', async () => {
    const tokens = service(clock);
    const issued = await tokens.issue(claims);
    expect(issued.expiresAt.toISOString()).toBe('2026-11-08T12:15:00.000Z'); // default TTL 900s
    await expect(tokens.verify(issued.token)).resolves.toEqual(claims);
  });

  it('reports TOKEN_EXPIRED once the TTL has passed, and not before', async () => {
    const tokens = service(clock, { ACCESS_TOKEN_TTL_SECONDS: '60' });
    const { token } = await tokens.issue(claims);
    clock.advanceBy(59_000);
    await expect(tokens.verify(token)).resolves.toEqual(claims);
    clock.advanceBy(2_000);
    await expect(tokens.verify(token)).rejects.toBeInstanceOf(AccessTokenExpiredError);
  });

  it('rejects a token for another audience', async () => {
    const token = await forge(current.privateKey, 'k1', { aud: 'someone-else' });
    await expect(service(clock).verify(token)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('rejects a token signed by a different key, even with our kid', async () => {
    const token = await forge(newKey().privateKey, 'k1');
    await expect(service(clock).verify(token)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('rejects an unknown kid and a token without signature algorithm ES256', async () => {
    await expect(service(clock).verify(await forge(current.privateKey, 'k9'))).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
    const hmac = await new SignJWT({ sid: claims.sessionId })
      .setProtectedHeader({ alg: 'HS256', kid: 'k1' })
      .setSubject(claims.userId)
      .sign(new TextEncoder().encode('a-guessable-shared-secret-of-32b'));
    await expect(service(clock).verify(hmac)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('rejects a token whose payload was edited after signing', async () => {
    const [header, , signature] = (await service(clock).issue(claims)).token.split('.');
    const edited = Buffer.from(JSON.stringify({ sub: 'someone-else', sid: claims.sessionId })).toString('base64url');
    await expect(service(clock).verify(`${header}.${edited}.${signature}`)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
    await expect(service(clock).verify('not-a-jwt')).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('still accepts tokens signed with the previous key during a rotation', async () => {
    const previous = newKey();
    const oldToken = await forge(previous.privateKey, 'k0');
    const rotated = service(clock, {
      JWT_PREVIOUS_PUBLIC_KEY: publicPem(previous.publicKey),
      JWT_PREVIOUS_KEY_ID: 'k0',
    });
    await expect(rotated.verify(oldToken)).resolves.toEqual(claims);
    await expect(service(clock).verify(oldToken)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });
});
