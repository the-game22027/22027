/** Shared Jest settings: ts-jest (CommonJS) and the tsconfig path aliases. */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    // The generated Prisma client imports its own .ts files with .js extensions (ESM-style specifiers).
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@generated/(.*)$': '<rootDir>/src/generated/$1',
  },
};
