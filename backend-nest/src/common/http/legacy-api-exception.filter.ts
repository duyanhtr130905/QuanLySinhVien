import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { ApiResponseFactory } from './api-response.factory';
import { LegacyApiException } from './legacy-api.exception';
import { LEGACY_FALLBACK_CODE, LEGACY_FALLBACK_REQUEST_KEY } from './legacy-fallback.decorator';

type MetadataArgumentsHost = ArgumentsHost & {
  getHandler?: () => Function | undefined;
  getClass?: () => Function | undefined;
};

@Catch()
@Injectable()
export class LegacyApiExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly reflector: Reflector,
    private readonly responses: ApiResponseFactory,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof LegacyApiException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    if (this.isLegacyApplicationError(exception)) {
      response.status(exception.status).json(this.responses.error(exception.status, exception.code, exception.message));
      return;
    }

    // Keep framework HTTP exceptions (for example a missing route) intact.
    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const fallbackCode = this.getFallbackCode(host);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      this.responses.error(
        HttpStatus.INTERNAL_SERVER_ERROR,
        fallbackCode,
        'Lỗi hệ thống không xác định',
      ),
    );
  }

  private getFallbackCode(host: ArgumentsHost): string {
    const request = host.switchToHttp().getRequest<Record<PropertyKey, unknown>>();
    const requestFallback = request[LEGACY_FALLBACK_REQUEST_KEY];
    if (typeof requestFallback === 'string') return requestFallback;
    const metadataHost = host as MetadataArgumentsHost;
    const handler = metadataHost.getHandler?.();
    const controller = metadataHost.getClass?.();
    const targets = [handler, controller].filter((target): target is Function => typeof target === 'function');
    const fallback = this.reflector.getAllAndOverride(LEGACY_FALLBACK_CODE, targets);
    return typeof fallback === 'string' ? fallback : '600';
  }

  private isLegacyApplicationError(error: unknown): error is { legacyApplicationError: true; status: number; code: string; message: string } {
    return typeof error === 'object' && error !== null
      && (error as { legacyApplicationError?: unknown }).legacyApplicationError === true
      && typeof (error as { status?: unknown }).status === 'number'
      && typeof (error as { code?: unknown }).code === 'string';
  }
}
