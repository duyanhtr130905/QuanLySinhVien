import { HttpException } from '@nestjs/common';
import { LegacyApiResponse } from './api-response.factory';

export interface LegacyApiExceptionOptions<T = null> {
  status: number;
  code: string;
  message: string;
  data?: T;
  cause?: Error;
}

export class LegacyApiException<T = null> extends HttpException {
  readonly code: string;
  readonly data: T;

  constructor(options: LegacyApiExceptionOptions<T>) {
    const data = options.data ?? (null as T);
    const response: LegacyApiResponse<T> = {
      code: options.code,
      status: options.status,
      message: options.message,
      data,
    };
    super(response, options.status, { cause: options.cause });
    this.code = options.code;
    this.data = data;
  }
}
