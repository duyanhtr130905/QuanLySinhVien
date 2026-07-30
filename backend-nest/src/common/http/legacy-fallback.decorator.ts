import { SetMetadata } from '@nestjs/common';

export const LEGACY_FALLBACK_CODE = 'legacy:fallback-code';
export const LEGACY_FALLBACK_REQUEST_KEY = Symbol('legacy:fallback-request-key');

/** Declares the legacy unknown-error code for a future controller or handler. */
export const LegacyFallback = (code: string): MethodDecorator & ClassDecorator => SetMetadata(LEGACY_FALLBACK_CODE, code);
