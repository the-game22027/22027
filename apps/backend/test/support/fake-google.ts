import { exportJWK, SignJWT } from 'jose';
import { generateKeyPairSync } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export const FAKE_GOOGLE_CLIENT_ID = 'test-android-client';

/** Serves a JWKS like Google's and signs ID tokens with the matching private key. */
export class FakeGoogle {
  private readonly key = generateKeyPairSync('rsa', { modulusLength: 2048 });
  private server: Server | undefined;
  jwksUrl = '';

  async start(): Promise<this> {
    const jwk = { ...(await exportJWK(this.key.publicKey)), kid: 'fake-google', alg: 'RS256', use: 'sig' };
    this.server = createServer((_req, res) => res.end(JSON.stringify({ keys: [jwk] })));
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    this.jwksUrl = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/certs`;
    return this;
  }

  stop(): Promise<void> {
    return new Promise((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }

  env(): Record<string, string> {
    return { GOOGLE_JWKS_URL: this.jwksUrl, GOOGLE_CLIENT_IDS: FAKE_GOOGLE_CLIENT_ID };
  }

  idToken(subject: string, claims: { email?: string; name?: string } = {}): Promise<string> {
    return new SignJWT({ email_verified: true, ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'fake-google' })
      .setIssuer('https://accounts.google.com')
      .setAudience(FAKE_GOOGLE_CLIENT_ID)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(this.key.privateKey);
  }
}
