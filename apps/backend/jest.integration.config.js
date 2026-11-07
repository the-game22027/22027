/** Integration tests: repositories, transactions, outbox and Redis against real containers (Testcontainers). */
const base = require('./jest.base.config');

module.exports = {
  ...base,
  displayName: 'integration',
  testMatch: ['<rootDir>/test/integration/**/*.int-spec.ts'],
  globalSetup: '<rootDir>/test/support/global-setup.ts',
  globalTeardown: '<rootDir>/test/support/global-teardown.ts',
  testTimeout: 60_000,
};
