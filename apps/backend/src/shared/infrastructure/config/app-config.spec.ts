import { ConfigValidationError, loadConfig } from './app-config';

const valid = {
  DATABASE_URL: 'postgresql://game:game@localhost:5440/app',
  REDIS_URL: 'redis://localhost:6379',
};

describe('loadConfig', () => {
  it('applies defaults to a minimal valid environment', () => {
    const config = loadConfig(valid);
    expect(config.nodeEnv).toBe('development');
    expect(config.apiPort).toBe(3000);
    expect(config.workerPort).toBe(3100);
    expect(config.outbox).toEqual({ pollIntervalMs: 1000, batchSize: 100 });
    expect(config.devToolsEnabled).toBe(true);
  });

  it('disables dev tools in production', () => {
    expect(loadConfig({ ...valid, NODE_ENV: 'production' }).devToolsEnabled).toBe(false);
  });

  it('reports every problem at once with the variable names', () => {
    let error: unknown;
    try {
      loadConfig({ REDIS_URL: 'http://not-redis', API_PORT: 'abc' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ConfigValidationError);
    const issues = (error as ConfigValidationError).issues.join('\n');
    expect(issues).toContain('DATABASE_URL');
    expect(issues).toContain('REDIS_URL');
    expect(issues).toContain('API_PORT');
  });
});
