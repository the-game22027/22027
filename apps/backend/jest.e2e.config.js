/** End-to-end tests: full HTTP flows through the booted API (Supertest) against real containers. */
const base = require('./jest.base.config');

module.exports = {
  ...base,
  displayName: 'e2e',
  testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
  globalSetup: '<rootDir>/test/support/global-setup.ts',
  globalTeardown: '<rootDir>/test/support/global-teardown.ts',
  testTimeout: 60_000,
};
