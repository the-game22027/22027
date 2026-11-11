import { createPrivateKey, createPublicKey } from 'node:crypto';
import { z } from 'zod';

// .env files hold the PEM on one line with literal \n.
const list = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

const regex = z.string().refine((value) => {
  try {
    new RegExp(value);
    return true;
  } catch {
    return false;
  }
}, 'must be a valid regular expression');

const pem = z.string().transform((value) => value.replace(/\\n/g, '\n'));

function isKey(parse: (pem: string) => { asymmetricKeyType?: string; asymmetricKeyDetails?: { namedCurve?: string } }) {
  return (value: string): boolean => {
    try {
      const key = parse(value);
      return key.asymmetricKeyType === 'ec' && key.asymmetricKeyDetails?.namedCurve === 'prime256v1';
    } catch {
      return false;
    }
  };
}

/**
 * Every environment variable the backend reads, validated once at boot. Nothing else in the
 * codebase reads `process.env`: inject `AppConfig` instead (CLAUDE.md §3).
 *
 * zod was chosen over class-validator here because one schema gives both runtime validation and the
 * inferred TypeScript type, and the config is plain data with no DTO/decorator needs.
 */
const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(3100),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }),
    HTTP_BODY_LIMIT: z
      .string()
      .regex(/^\d+(b|kb|mb)$/i, 'e.g. 100kb')
      .default('100kb'),
    OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(50).default(1000),
    OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(1000).default(100),
    OUTBOX_LEASE_MS: z.coerce.number().int().min(100).default(60_000),
    OUTBOX_PUBLISH_TIMEOUT_MS: z.coerce.number().int().min(10).default(5000),
    OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(10),
    OUTBOX_RETRY_BASE_MS: z.coerce.number().int().min(1).default(1000),
    OUTBOX_RETRY_MAX_MS: z.coerce.number().int().min(1).default(300_000),

    JWT_PRIVATE_KEY: pem.refine(isKey(createPrivateKey), 'must be a P-256 (ES256) private key in PEM format'),
    JWT_KEY_ID: z.string().min(1),
    JWT_PREVIOUS_PUBLIC_KEY: pem
      .refine(isKey(createPublicKey), 'must be a P-256 (ES256) public key in PEM format')
      .optional(),
    JWT_PREVIOUS_KEY_ID: z.string().min(1).optional(),
    JWT_ISSUER: z.string().min(1).default('the-game-api'),
    JWT_AUDIENCE: z.string().min(1).default('the-game-app'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
    REFRESH_TOKEN_SLIDING_DAYS: z.coerce.number().int().min(1).default(60),
    REFRESH_TOKEN_ABSOLUTE_DAYS: z.coerce.number().int().min(1).default(180),

    GOOGLE_CLIENT_IDS: list.default([]),
    GOOGLE_JWKS_URL: z.url().default('https://www.googleapis.com/oauth2/v3/certs'),
    GOOGLE_ISSUERS: list.default(['https://accounts.google.com', 'accounts.google.com']),

    FOOTBALL_SYNC_INTERVAL_SECONDS: z.coerce.number().int().min(1).default(3600),
    FOOTBALL_SYNC_PAST_DAYS: z.coerce.number().int().min(0).default(30),
    FOOTBALL_SYNC_FUTURE_DAYS: z.coerce.number().int().min(0).default(60),
    MOCK_FOOTBALL_SEED_DIR: z.string().min(1).default('prisma/seed/football'),
    BATTLE_CONFIG_PATH: z.string().min(1).default('config/battles.dev.json'),

    RATE_LIMIT_AUTH_PER_MINUTE: z.coerce.number().int().min(1).default(20),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),

    USERNAME_PATTERN: regex.default('^[A-Za-z0-9_]{3,20}$'),
    ACCOUNT_DELETION_RECENT_SIGN_IN_SECONDS: z.coerce.number().int().min(1).default(600),

    PREDICTION_MAX_GOALS: z.coerce.number().int().min(1).max(99).default(20),
  })
  .refine((env) => env.OUTBOX_LEASE_MS > 2 * env.OUTBOX_PUBLISH_TIMEOUT_MS, {
    message: 'must be more than twice OUTBOX_PUBLISH_TIMEOUT_MS, so a publish always ends inside its lease',
    path: ['OUTBOX_LEASE_MS'],
  })
  .refine((env) => env.OUTBOX_RETRY_MAX_MS >= env.OUTBOX_RETRY_BASE_MS, {
    message: 'must be at least OUTBOX_RETRY_BASE_MS',
    path: ['OUTBOX_RETRY_MAX_MS'],
  })
  .refine((env) => (env.JWT_PREVIOUS_PUBLIC_KEY === undefined) === (env.JWT_PREVIOUS_KEY_ID === undefined), {
    message: 'set both or neither (key rotation)',
    path: ['JWT_PREVIOUS_KEY_ID'],
  })
  .refine((env) => env.REFRESH_TOKEN_ABSOLUTE_DAYS >= env.REFRESH_TOKEN_SLIDING_DAYS, {
    message: 'must be at least REFRESH_TOKEN_SLIDING_DAYS',
    path: ['REFRESH_TOKEN_ABSOLUTE_DAYS'],
  });

type ConfigEnv = z.infer<typeof configSchema>;

export class AppConfig {
  readonly nodeEnv: ConfigEnv['NODE_ENV'];
  readonly logLevel: ConfigEnv['LOG_LEVEL'];
  readonly apiPort: number;
  readonly workerPort: number;
  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly httpBodyLimit: string;
  readonly outbox: {
    readonly pollIntervalMs: number;
    readonly batchSize: number;
    readonly leaseMs: number;
    readonly publishTimeoutMs: number;
    readonly maxAttempts: number;
    readonly retryBaseMs: number;
    readonly retryMaxMs: number;
  };
  readonly jwt: {
    readonly privateKeyPem: string;
    readonly keyId: string;
    readonly previous?: { readonly keyId: string; readonly publicKeyPem: string };
    readonly issuer: string;
    readonly audience: string;
    readonly accessTokenTtlSeconds: number;
  };
  readonly refreshToken: { readonly slidingDays: number; readonly absoluteDays: number };
  readonly google: {
    readonly clientIds: readonly string[];
    readonly jwksUrl: string;
    readonly issuers: readonly string[];
  };

  readonly footballSync: {
    readonly intervalSeconds: number;
    readonly pastDays: number;
    readonly futureDays: number;
    readonly mockSeedDir: string;
  };
  readonly rateLimit: { readonly authPerMinute: number };
  readonly trustProxyHops: number;
  readonly profile: { readonly usernamePattern: RegExp };
  readonly accountDeletion: { readonly recentSignInSeconds: number };
  readonly predictions: { readonly maxGoals: number };
  /** The battle config file (ADR-0017); its contents are validated by the battles module. */
  readonly battleConfigPath: string;

  constructor(env: ConfigEnv) {
    this.nodeEnv = env.NODE_ENV;
    this.logLevel = env.LOG_LEVEL;
    this.apiPort = env.API_PORT;
    this.workerPort = env.WORKER_PORT;
    this.databaseUrl = env.DATABASE_URL;
    this.redisUrl = env.REDIS_URL;
    this.httpBodyLimit = env.HTTP_BODY_LIMIT;
    this.outbox = {
      pollIntervalMs: env.OUTBOX_POLL_INTERVAL_MS,
      batchSize: env.OUTBOX_BATCH_SIZE,
      leaseMs: env.OUTBOX_LEASE_MS,
      publishTimeoutMs: env.OUTBOX_PUBLISH_TIMEOUT_MS,
      maxAttempts: env.OUTBOX_MAX_ATTEMPTS,
      retryBaseMs: env.OUTBOX_RETRY_BASE_MS,
      retryMaxMs: env.OUTBOX_RETRY_MAX_MS,
    };
    this.jwt = {
      privateKeyPem: env.JWT_PRIVATE_KEY,
      keyId: env.JWT_KEY_ID,
      ...(env.JWT_PREVIOUS_PUBLIC_KEY && env.JWT_PREVIOUS_KEY_ID
        ? { previous: { keyId: env.JWT_PREVIOUS_KEY_ID, publicKeyPem: env.JWT_PREVIOUS_PUBLIC_KEY } }
        : {}),
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
    };
    this.google = { clientIds: env.GOOGLE_CLIENT_IDS, jwksUrl: env.GOOGLE_JWKS_URL, issuers: env.GOOGLE_ISSUERS };
    this.footballSync = {
      intervalSeconds: env.FOOTBALL_SYNC_INTERVAL_SECONDS,
      pastDays: env.FOOTBALL_SYNC_PAST_DAYS,
      futureDays: env.FOOTBALL_SYNC_FUTURE_DAYS,
      mockSeedDir: env.MOCK_FOOTBALL_SEED_DIR,
    };
    this.rateLimit = { authPerMinute: env.RATE_LIMIT_AUTH_PER_MINUTE };
    this.trustProxyHops = env.TRUST_PROXY_HOPS;
    this.profile = { usernamePattern: new RegExp(env.USERNAME_PATTERN) };
    this.accountDeletion = { recentSignInSeconds: env.ACCOUNT_DELETION_RECENT_SIGN_IN_SECONDS };
    this.predictions = { maxGoals: env.PREDICTION_MAX_GOALS };
    this.battleConfigPath = env.BATTLE_CONFIG_PATH;
    this.refreshToken = { slidingDays: env.REFRESH_TOKEN_SLIDING_DAYS, absoluteDays: env.REFRESH_TOKEN_ABSOLUTE_DAYS };
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  /** Swagger UI, Bull Board and `/v1/_dev/*` routes exist only outside production. */
  get devToolsEnabled(): boolean {
    return !this.isProduction;
  }
}

export class ConfigValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid configuration:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'ConfigValidationError';
  }
}

/** Parses raw environment variables. Throws `ConfigValidationError` listing every problem at once. */
export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    throw new ConfigValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  return new AppConfig(result.data);
}
