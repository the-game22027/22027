/**
 * Architecture boundaries (CLAUDE.md §3, docs/architecture/01-modules.md §3-4).
 * Run: npm run depcheck:boundaries
 */
const FRAMEWORKS =
  '^node_modules/(@nestjs|@nestjs-cls|nestjs-cls|nestjs-pino|@prisma|prisma|bullmq|ioredis|socket\\.io|express|@prometheus-io)(/|$)';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-framework-free',
      severity: 'error',
      comment: 'Domain code and the shared kernel are plain TypeScript: no NestJS, Prisma, Redis, BullMQ, Socket.IO.',
      from: { path: ['^src/modules/[^/]+/domain/', '^src/shared/kernel/'] },
      to: { path: [FRAMEWORKS, '^src/generated/', '^src/shared/infrastructure/'] },
    },
    {
      name: 'no-deep-module-imports',
      severity: 'error',
      comment: "Modules talk only through another module's public entry: import from '@modules/<name>' (its index.ts).",
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/', pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$'] },
    },
    {
      name: 'shared-does-not-know-modules',
      severity: 'error',
      comment: 'shared/ is below every business module and must not depend on one.',
      from: { path: '^src/shared/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Cycles between files make module boundaries meaningless (01-modules.md §3 rule 1).',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^src/generated/' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'] },
  },
};
