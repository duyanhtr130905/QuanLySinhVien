import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiResponseFactory } from './api-response.factory';
import { LegacyApiExceptionFilter } from './legacy-api-exception.filter';
import { LegacyApiException } from './legacy-api.exception';
import { LEGACY_FALLBACK_CODE, LEGACY_FALLBACK_REQUEST_KEY, LegacyFallback } from './legacy-fallback.decorator';
import { LegacyFallbackInterceptor } from './legacy-fallback.interceptor';

describe('HTTP infrastructure', () => {
  const factory = new ApiResponseFactory();

  it('creates the exact legacy success and error envelopes', () => {
    expect(factory.success({ id: 1 }, 'Đã tạo')).toEqual({ code: '200', status: 200, message: 'Đã tạo', data: { id: 1 } });
    expect(factory.error(400, 'E603', 'Không hợp lệ')).toEqual({ code: 'E603', status: 400, message: 'Không hợp lệ', data: null });
  });

  it('preserves LegacyApiException status, code, message, data, and cause', () => {
    const cause = new Error('cause');
    const exception = new LegacyApiException({ status: 409, code: 'E603', message: 'Trùng dữ liệu', data: { field: 'email' }, cause });

    expect(exception.getStatus()).toBe(409);
    expect(exception.getResponse()).toEqual({ code: 'E603', status: 409, message: 'Trùng dữ liệu', data: { field: 'email' } });
    expect(exception.cause).toBe(cause);
  });

  it('stores fallback metadata for a future handler', () => {
    class Controller {}
    LegacyFallback('B600')(Controller);

    expect(Reflect.getMetadata(LEGACY_FALLBACK_CODE, Controller)).toBe('B600');
  });

  it('returns a declared fallback envelope for unknown errors without stack data', () => {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const request = { [LEGACY_FALLBACK_REQUEST_KEY]: 'C600' };
    const host = {
      switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ArgumentsHost;
    const filter = new LegacyApiExceptionFilter(new Reflector(), factory);

    filter.catch(new Error('database password must not leak'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith({
      code: 'C600', status: 500, message: 'Lỗi hệ thống không xác định', data: null,
    });
  });

  it('returns the exact LegacyApiException response through the filter', () => {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host = { switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({}) }) } as unknown as ArgumentsHost;
    const filter = new LegacyApiExceptionFilter(new Reflector(), factory);

    filter.catch(new LegacyApiException({ status: 404, code: 'D604', message: 'Không tìm thấy' }), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ code: 'D604', status: 404, message: 'Không tìm thấy', data: null });
  });

  it('makes decorator metadata available to the exception filter request path', () => {
    const handler = () => undefined;
    Reflect.defineMetadata(LEGACY_FALLBACK_CODE, 'L600', handler);
    const request: Record<PropertyKey, unknown> = {};
    const interceptor = new LegacyFallbackInterceptor(new Reflector());
    const context = {
      getHandler: () => handler,
      getClass: () => class Controller {},
      switchToHttp: () => ({ getRequest: () => request }),
    };

    interceptor.intercept(context as never, { handle: () => ({ subscribe: () => undefined }) } as never);

    expect(request[LEGACY_FALLBACK_REQUEST_KEY]).toBe('L600');
  });
});
