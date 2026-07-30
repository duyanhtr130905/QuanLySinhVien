import { Module } from '@nestjs/common';
import { ApiResponseFactory } from './api-response.factory';
import { LegacyApiExceptionFilter } from './legacy-api-exception.filter';
import { LegacyFallbackInterceptor } from './legacy-fallback.interceptor';

@Module({
  providers: [ApiResponseFactory, LegacyApiExceptionFilter, LegacyFallbackInterceptor],
  exports: [ApiResponseFactory, LegacyApiExceptionFilter, LegacyFallbackInterceptor],
})
export class HttpModule {}
