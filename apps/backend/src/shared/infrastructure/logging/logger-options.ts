import type { Options } from 'pino-http';
import type { AppConfig } from '../config';
import { resolveRequestId } from '../request-context/request-id';

const REDACTED = '[REDACTED]';

/**
 * Paths that must never appear in logs (CLAUDE.md §5). pino wildcards match one level, so the
 * sensitive keys are listed at the top level of a logged object and one level below it.
 */
const SENSITIVE_KEYS = ['token', 'accessToken', 'refreshToken', 'idToken', 'code', 'otp', 'password', 'phone'];

export const REDACT_PATHS: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  ...SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
];

/** Phone numbers keep their last 2 digits for support/debugging; everything else is fully hidden. */
export function censor(value: unknown, path: string[]): string {
  const key = path[path.length - 1];
  if (key === 'phone' && typeof value === 'string' && value.length > 2) {
    return `${'*'.repeat(value.length - 2)}${value.slice(-2)}`;
  }
  return REDACTED;
}

const QUIET_ROUTES = ['/health/live', '/health/ready', '/metrics'];

export function buildPinoHttpOptions(config: AppConfig): Options {
  return {
    level: config.logLevel,
    redact: { paths: REDACT_PATHS, censor },
    genReqId: (req, res) => resolveRequestId(req, res),
    customAttributeKeys: { reqId: 'requestId' },
    autoLogging: { ignore: (req) => QUIET_ROUTES.some((route) => req.url?.startsWith(route) ?? false) },
    serializers: {
      req: (req: { id: unknown; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    ...(config.nodeEnv === 'development'
      ? { transport: { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' } } }
      : {}),
  };
}
