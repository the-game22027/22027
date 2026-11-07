import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ApiModule } from '../../src/api.module';
import { configureHttpApp } from '../../src/bootstrap/configure-http-app';
import { type AppConfig, loadConfig } from '../../src/shared/infrastructure/config';

/** Config pointing at the Testcontainers started in global-setup.ts, with optional overrides. */
export function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: process.env['DATABASE_URL'],
    REDIS_URL: process.env['REDIS_URL'],
    ...overrides,
  });
}

/** Boots the API exactly like main.api.ts (same module, same HTTP setup), without listening on a port. */
export async function createApiTestApp(config: AppConfig = testConfig()): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [ApiModule.register(config)] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true, bodyParser: false });
  configureHttpApp(app, { api: true });
  await app.init();
  return app;
}
