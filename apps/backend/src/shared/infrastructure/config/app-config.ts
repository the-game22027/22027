import { z } from 'zod';

/**
 * Every environment variable the backend reads, validated once at boot. Nothing else in the
 * codebase reads `process.env`: inject `AppConfig` instead (CLAUDE.md §3).
 *
 * zod was chosen over class-validator here because one schema gives both runtime validation and the
 * inferred TypeScript type, and the config is plain data with no DTO/decorator needs.
 */
const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(3100),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  HTTP_BODY_LIMIT: z.string().regex(/^\d+(b|kb|mb)$/i, 'e.g. 100kb').default('100kb'),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(50).default(1000),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(1000).default(100),
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
  readonly outbox: { readonly pollIntervalMs: number; readonly batchSize: number };

  constructor(env: ConfigEnv) {
    this.nodeEnv = env.NODE_ENV;
    this.logLevel = env.LOG_LEVEL;
    this.apiPort = env.API_PORT;
    this.workerPort = env.WORKER_PORT;
    this.databaseUrl = env.DATABASE_URL;
    this.redisUrl = env.REDIS_URL;
    this.httpBodyLimit = env.HTTP_BODY_LIMIT;
    this.outbox = { pollIntervalMs: env.OUTBOX_POLL_INTERVAL_MS, batchSize: env.OUTBOX_BATCH_SIZE };
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
