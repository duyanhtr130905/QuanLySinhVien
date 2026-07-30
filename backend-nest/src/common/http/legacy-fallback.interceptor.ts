import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { LEGACY_FALLBACK_CODE, LEGACY_FALLBACK_REQUEST_KEY } from './legacy-fallback.decorator';

type LegacyFallbackRequest = Record<PropertyKey, unknown>;

/** Makes controller/handler fallback metadata available to the global filter. */
@Injectable()
export class LegacyFallbackInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const fallback = this.reflector.getAllAndOverride(
      LEGACY_FALLBACK_CODE,
      [context.getHandler(), context.getClass()],
    );
    if (typeof fallback === 'string') {
      const request = context.switchToHttp().getRequest<LegacyFallbackRequest>();
      request[LEGACY_FALLBACK_REQUEST_KEY] = fallback;
    }
    return next.handle();
  }
}
