/** Unit tests: domain and application logic, no Nest app, no database. */
const base = require('./jest.base.config');

module.exports = {
  ...base,
  displayName: 'unit',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
};
