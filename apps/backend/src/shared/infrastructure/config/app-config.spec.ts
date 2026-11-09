import { generateKeyPairSync } from 'node:crypto';
import { ConfigValidationError, loadConfig } from './app-config';

const es256 = () => generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pem = (key: ReturnType<typeof es256>) => ({
  privateKey: key.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  publicKey: key.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
});
const current = pem(es256());

const valid = {
  DATABASE_URL: 'postgresql://game:game@localhost:5440/app',
  REDIS_URL: 'redis://localhost:6379',
  JWT_PRIVATE_KEY: current.privateKey,
  JWT_KEY_ID: 'k1',
};

function issuesOf(env: Record<string, string | undefined>): string {
  try {
    loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigValidationError) return error.issues.join('\n');
    throw error;
  }
  throw new Error('expected a ConfigValidationError');
}

describe('loadConfig', () => {
  it('applies defaults to a minimal valid environment', () => {
    const config = loadConfig(valid);
    expect(config.nodeEnv).toBe('development');
    expect(config.apiPort).toBe(3000);
    expect(config.workerPort).toBe(3100);
    expect(config.outbox).toEqual({ pollIntervalMs: 1000, batchSize: 100 });
    expect(config.devToolsEnabled).toBe(true);
    expect(config.jwt).toMatchObject({ keyId: 'k1', issuer: 'the-game-api', accessTokenTtlSeconds: 900 });
    expect(config.jwt.previous).toBeUndefined();
    expect(config.refreshToken).toEqual({ slidingDays: 60, absoluteDays: 180 });
    expect(config.google).toMatchObject({
      clientIds: [],
      issuers: ['https://accounts.google.com', 'accounts.google.com'],
    });
  });

  it('disables dev tools in production', () => {
    expect(loadConfig({ ...valid, NODE_ENV: 'production' }).devToolsEnabled).toBe(false);
  });

  it('reports every problem at once with the variable names', () => {
    let error: unknown;
    try {
      loadConfig({ REDIS_URL: 'http://not-redis', API_PORT: 'abc' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ConfigValidationError);
    const issues = (error as ConfigValidationError).issues.join('\n');
    expect(issues).toContain('DATABASE_URL');
    expect(issues).toContain('REDIS_URL');
    expect(issues).toContain('API_PORT');
  });

  it('accepts a PEM written on one line with literal \\n, as in .env files', () => {
    const oneLine = current.privateKey.trim().replace(/\n/g, '\\n');
    expect(loadConfig({ ...valid, JWT_PRIVATE_KEY: oneLine }).jwt.privateKeyPem).toBe(current.privateKey.trim());
  });

  it('refuses a missing, malformed or non-P-256 signing key', () => {
    expect(issuesOf({ ...valid, JWT_PRIVATE_KEY: undefined })).toContain('JWT_PRIVATE_KEY');
    expect(issuesOf({ ...valid, JWT_PRIVATE_KEY: 'not a key' })).toContain('JWT_PRIVATE_KEY');
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const rsaPem = rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    expect(issuesOf({ ...valid, JWT_PRIVATE_KEY: rsaPem })).toContain('P-256');
  });

  it('accepts a previous public key for rotation only together with its key id', () => {
    const previous = pem(es256());
    expect(issuesOf({ ...valid, JWT_PREVIOUS_PUBLIC_KEY: previous.publicKey })).toContain('JWT_PREVIOUS_KEY_ID');
    const config = loadConfig({ ...valid, JWT_PREVIOUS_PUBLIC_KEY: previous.publicKey, JWT_PREVIOUS_KEY_ID: 'k0' });
    expect(config.jwt.previous).toEqual({ keyId: 'k0', publicKeyPem: previous.publicKey });
  });

  it('refuses an absolute refresh lifetime shorter than the sliding one', () => {
    expect(issuesOf({ ...valid, REFRESH_TOKEN_SLIDING_DAYS: '90', REFRESH_TOKEN_ABSOLUTE_DAYS: '30' })).toContain(
      'REFRESH_TOKEN_ABSOLUTE_DAYS',
    );
  });

  it('reads Google client ids as a comma-separated list', () => {
    expect(loadConfig({ ...valid, GOOGLE_CLIENT_IDS: ' android.apps , ios.apps,' }).google.clientIds).toEqual([
      'android.apps',
      'ios.apps',
    ]);
  });
});
