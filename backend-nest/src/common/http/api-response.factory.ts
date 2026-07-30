import { Injectable } from '@nestjs/common';

export interface LegacyApiResponse<T> {
  code: string;
  status: number;
  message: string;
  data: T;
}

@Injectable()
export class ApiResponseFactory {
  success<T>(data: T, message = 'Thành công'): LegacyApiResponse<T> {
    return { code: '200', status: 200, message, data };
  }

  error<T = null>(status: number, code: string, message: string, data: T = null as T): LegacyApiResponse<T> {
    return { code, status, message, data };
  }
}
