import appConfig from './app.config';

describe('appConfig', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('corsAllowedOrigins', () => {
    it('defaults to http://localhost:3001 when CORS_ALLOWED_ORIGINS is absent', () => {
      delete process.env.CORS_ALLOWED_ORIGINS;
      const config = appConfig();
      expect(config.app.corsAllowedOrigins).toEqual([
        'http://localhost:3001',
      ]);
    });

    it('parses a single origin', () => {
      process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';
      const config = appConfig();
      expect(config.app.corsAllowedOrigins).toEqual([
        'https://app.example.com',
      ]);
    });

    it('parses multiple comma-separated origins and trims whitespace', () => {
      process.env.CORS_ALLOWED_ORIGINS =
        'http://localhost:3001 , https://app.example.com , https://staging.example.com';
      const config = appConfig();
      expect(config.app.corsAllowedOrigins).toEqual([
        'http://localhost:3001',
        'https://app.example.com',
        'https://staging.example.com',
      ]);
    });

    it('filters empty entries from trailing commas', () => {
      process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3001,,';
      const config = appConfig();
      expect(config.app.corsAllowedOrigins).toEqual([
        'http://localhost:3001',
      ]);
    });
  });

  describe('port', () => {
    it('defaults to 3002 when PORT is absent', () => {
      delete process.env.PORT;
      const config = appConfig();
      expect(config.app.port).toBe(3002);
    });
  });
});
