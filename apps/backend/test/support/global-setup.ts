import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';

declare global {
  var __TEST_CONTAINERS__: [StartedPostgreSqlContainer, StartedRedisContainer] | undefined;
}

/**
 * Starts one real Postgres and one real Redis per test run (same images as docker-compose.yml) and
 * applies the Prisma migrations. Test workers inherit DATABASE_URL / REDIS_URL from this process.
 */
export default async function globalSetup(): Promise<void> {
  const [postgres, redis] = await Promise.all([
    new PostgreSqlContainer('postgres:17-alpine').withDatabase('app').withUsername('game').withPassword('game').start(),
    new RedisContainer('redis:7-alpine').withCommand(['redis-server', '--maxmemory-policy', 'noeviction']).start(),
  ]);
  process.env['DATABASE_URL'] = postgres.getConnectionUri();
  process.env['REDIS_URL'] = redis.getConnectionUrl();

  execFileSync(resolve(__dirname, '../../node_modules/.bin/prisma'), ['migrate', 'deploy'], {
    cwd: resolve(__dirname, '../..'),
    env: process.env,
    stdio: 'pipe',
  });

  globalThis.__TEST_CONTAINERS__ = [postgres, redis];
}
