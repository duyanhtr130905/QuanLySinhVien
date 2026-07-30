import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('returns the exact legacy health payload', () => {
      expect(appController.getHealth()).toEqual({
        status: 'ok',
        message: 'Quản lý Sinh viên API đang hoạt động',
      });
    });
  });
});
