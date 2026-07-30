import { ApiResponseFactory } from '../../../common/http/api-response.factory';
import { LEGACY_FALLBACK_CODE } from '../../../common/http/legacy-fallback.decorator';
import { LegacyApiException } from '../../../common/http/legacy-api.exception';
import type { HobbyService } from '../application/hobby.service';
import type { Hobby } from '../domain/hobby.entity';
import { HobbyController } from './hobby.controller';

const hobby: Hobby = { id: '7', code: 'HB4', name: 'Đọc sách', bit_value: 4, is_active: true };

describe('HobbyController', () => {
  const createController = () => {
    const service = { getAll: jest.fn(), create: jest.fn(), delete: jest.fn() };
    return {
      service,
      controller: new HobbyController(service as unknown as HobbyService, new ApiResponseFactory()),
    };
  };

  it('returns exact legacy success envelopes and messages', async () => {
    const { controller, service } = createController();
    service.getAll.mockResolvedValue([hobby]);
    service.create.mockResolvedValue(hobby);
    service.delete.mockResolvedValue({ id: '7' });

    await expect(controller.getAll()).resolves.toEqual({
      code: '200', status: 200, message: 'Lấy danh sách sở thích thành công', data: [hobby],
    });
    await expect(controller.create({ name: 'Đọc sách' })).resolves.toEqual({
      code: '200', status: 200, message: 'Tạo sở thích thành công', data: hobby,
    });
    await expect(controller.delete('7suffix')).resolves.toEqual({
      code: '200', status: 200, message: 'Xóa sở thích thành công', data: { id: '7' },
    });
    expect(service.delete).toHaveBeenCalledWith(7);
  });

  it('keeps legacy parseInt validation for delete ids', async () => {
    const { controller } = createController();

    await expect(controller.delete('invalid')).rejects.toBeInstanceOf(LegacyApiException);
    await expect(controller.delete('invalid')).rejects.toMatchObject({
      status: 400, code: 'G601', message: 'id không hợp lệ',
    });
  });

  it('declares the exact fallback metadata for each route', () => {
    expect(Reflect.getMetadata(LEGACY_FALLBACK_CODE, HobbyController.prototype.getAll)).toBe('B600');
    expect(Reflect.getMetadata(LEGACY_FALLBACK_CODE, HobbyController.prototype.create)).toBe('E600');
    expect(Reflect.getMetadata(LEGACY_FALLBACK_CODE, HobbyController.prototype.delete)).toBe('G600');
  });
});
