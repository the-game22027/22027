import { defineConfig } from 'prisma/config';

// Prisma 7 no longer loads .env by itself. Node's built-in loader avoids a dotenv dependency;
// in CI and tests the variables come from the environment instead.
try {
  process.loadEnvFile();
} catch {
  // no .env file: rely on the process environment
}

export default defineConfig({
  // Multi-file schema: one .prisma file per owning module (docs/architecture/02-database.md §1).
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'] ?? '',
  },
});
