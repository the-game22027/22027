import { Writable } from 'node:stream';
import pino from 'pino';
import { censor, REDACT_PATHS } from './logger-options';

function logged(object: Record<string, unknown>): string {
  let output = '';
  const sink = new Writable({
    write(chunk: Buffer, _encoding, done) {
      output += chunk.toString();
      done();
    },
  });
  pino({ redact: { paths: REDACT_PATHS, censor } }, sink).info(object, 'test');
  return output;
}

describe('log redaction', () => {
  it('removes tokens, cookies, OTP codes and passwords at top level and nested', () => {
    const line = logged({
      req: { headers: { authorization: 'Bearer eyJsecret', cookie: 'sid=secret-cookie' } },
      token: 'top-secret-token',
      body: { refreshToken: 'nested-refresh', code: '123456', password: 'hunter2' },
      deep: { auth: { idToken: 'deep-id-token' } },
    });
    for (const secret of ['eyJsecret', 'secret-cookie', 'top-secret-token', 'nested-refresh', '123456', 'hunter2', 'deep-id-token']) {
      expect(line).not.toContain(secret);
    }
    expect(line).toContain('[REDACTED]');
  });

  it('masks phone numbers except the last two digits', () => {
    const line = logged({ body: { phone: '+201001234567' } });
    expect(line).not.toContain('+201001234567');
    expect(line).toContain('***********67');
  });
});
