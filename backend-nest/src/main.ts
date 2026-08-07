import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { LegacyApiExceptionFilter } from './common/http/legacy-api-exception.filter';
import { LegacyFallbackInterceptor } from './common/http/legacy-fallback.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const allowedOrigins = configService.getOrThrow<string[]>(
    'app.corsAllowedOrigins',
  );

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (e.g. server-to-server, curl, health checks).
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.enableShutdownHooks();
  app.useGlobalInterceptors(app.get(LegacyFallbackInterceptor));
  app.useGlobalFilters(app.get(LegacyApiExceptionFilter));

  const port = configService.getOrThrow<number>('app.port');

  await app.listen(port);
  Logger.log(
    `NestJS server running at http://localhost:${port}`,
    'Bootstrap',
  );
  Logger.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`, 'Bootstrap');
}
bootstrap();
