/**
 * EnvironmentConfig semantics tests.
 *
 * Because `env` is evaluated at module import time (not lazily), each NODE_ENV
 * scenario must clear the module registry before importing EnvironmentConfig so
 * that `getEnv()` runs fresh with the desired process.env values.
 *
 * Pattern:
 *   1. Save original env.
 *   2. Apply scenario overrides.
 *   3. jest.resetModules() — purge the registry.
 *   4. require() the module — triggers a fresh evaluation.
 *   5. Assert.
 *   6. afterEach restores the original env and resets modules.
 */

describe('EnvironmentConfig', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    // Shallow-clone so mutations in each test are isolated.
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.resetModules();
  });

  test('development without override resolves to legacy http://localhost:3000', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.REACT_APP_API_BASE_URL;

    jest.resetModules();
    const { env } = require('./EnvironmentConfig');

    expect(env.API_ENDPOINT_URL).toBe('http://localhost:3000');
  });

  test('test without override resolves to https://api.test.com', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.REACT_APP_API_BASE_URL;

    jest.resetModules();
    const { env } = require('./EnvironmentConfig');

    expect(env.API_ENDPOINT_URL).toBe('https://api.test.com');
  });

  test('production without override resolves to https://api.prod.com', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.REACT_APP_API_BASE_URL;

    jest.resetModules();
    const { env } = require('./EnvironmentConfig');

    expect(env.API_ENDPOINT_URL).toBe('https://api.prod.com');
  });

  test('explicit REACT_APP_API_BASE_URL overrides NODE_ENV fallback (development)', () => {
    process.env.NODE_ENV = 'development';
    process.env.REACT_APP_API_BASE_URL = 'http://localhost:3002';

    jest.resetModules();
    const { env } = require('./EnvironmentConfig');

    expect(env.API_ENDPOINT_URL).toBe('http://localhost:3002');
  });

  test('explicit REACT_APP_API_BASE_URL overrides NODE_ENV fallback (production)', () => {
    process.env.NODE_ENV = 'production';
    process.env.REACT_APP_API_BASE_URL = 'https://nest.example.com';

    jest.resetModules();
    const { env } = require('./EnvironmentConfig');

    expect(env.API_ENDPOINT_URL).toBe('https://nest.example.com');
  });
});
