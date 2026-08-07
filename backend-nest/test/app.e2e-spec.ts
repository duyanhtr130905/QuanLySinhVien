import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    const configService = app.get(ConfigService);
    const allowedOrigins = configService.getOrThrow<string[]>(
      'app.corsAllowedOrigins',
    );

    app.enableCors({
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    });

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET / returns the exact legacy health contract without a global prefix', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({
        status: 'ok',
        message: 'Quản lý Sinh viên API đang hoạt động',
      });
  });

  it('does not expose the health route below /api', () => {
    return request(app.getHttpServer()).get('/api').expect(404);
  });

  describe('CORS origin enforcement', () => {
    it('allows requests with no Origin header (server-to-server / curl)', async () => {
      const res = await request(app.getHttpServer()).get('/').expect(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('allows the default frontend origin http://localhost:3001', async () => {
      const res = await request(app.getHttpServer())
        .options('/')
        .set('Origin', 'http://localhost:3001')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);
      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:3001',
      );
    });

    it('blocks an origin not in the allowlist without returning a 5xx response', async () => {
      const res = await request(app.getHttpServer())
        .options('/')
        .set('Origin', 'http://evil.example.com')
        .set('Access-Control-Request-Method', 'GET');
      expect(res.status).toBeLessThan(500);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('allows GET with the default origin and returns ACAO header', async () => {
      const res = await request(app.getHttpServer())
        .get('/')
        .set('Origin', 'http://localhost:3001')
        .expect(200);
      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:3001',
      );
    });

  });
});
