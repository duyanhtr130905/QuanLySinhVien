import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiResponseFactory } from '../src/common/http/api-response.factory';
import { ClassCopyService } from '../src/modules/class/application/class-copy.service';
import { ClassExportService } from '../src/modules/class/application/class-export.service';
import { ClassImportService } from '../src/modules/class/application/class-import.service';
import { ClassMembershipService } from '../src/modules/class/application/class-membership.service';
import { ClassAdvancedController } from '../src/modules/class/http/class-advanced.controller';
import { ClassImportMulterFilter } from '../src/modules/class/http/class-import-multer.filter';
import { ClassRequestParser } from '../src/modules/class/http/class-request.parser';

describe('Class import (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ClassAdvancedController],
      providers: [
        ApiResponseFactory,
        ClassImportMulterFilter,
        ClassRequestParser,
        { provide: ClassMembershipService, useValue: {} },
        { provide: ClassCopyService, useValue: {} },
        { provide: ClassImportService, useValue: { import: jest.fn() } },
        { provide: ClassExportService, useValue: {} },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => app.close());

  it('maps a file larger than 10MB to the legacy J604 contract', async () => {
    const response = await request(app.getHttpServer())
      .post('/class/import')
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), 'classes.csv')
      .expect(400);

    expect(response.body).toEqual({
      code: 'J604',
      status: 400,
      message: 'File không được vượt quá 10MB',
      data: null,
    });
  });
});
