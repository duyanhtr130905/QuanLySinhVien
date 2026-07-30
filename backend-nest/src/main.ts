import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { LegacyApiExceptionFilter } from './common/http/legacy-api-exception.filter';
import { LegacyFallbackInterceptor } from './common/http/legacy-fallback.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.enableShutdownHooks();
  app.useGlobalInterceptors(app.get(LegacyFallbackInterceptor));
  app.useGlobalFilters(app.get(LegacyApiExceptionFilter));

  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('app.port');

  await app.listen(port);
  Logger.log(`NestJS server running at http://localhost:${port}`, 'Bootstrap');
}
bootstrap();
