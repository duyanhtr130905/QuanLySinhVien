import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
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
    await app.init();
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

  afterEach(async () => {
    await app.close();
  });
});
