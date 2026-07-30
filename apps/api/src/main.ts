import './config/load-dotenv';
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { env } from './config/env';
import { ZodExceptionFilter } from './services/zod-filter';

async function bootstrap() {
  const config = env();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  const logger = new Logger('Bootstrap');
  const isProduction = config.NODE_ENV === 'production';
  const origins = [config.WEB_URL, config.ADMIN_URL].filter(Boolean);

  app.set('trust proxy', config.TRUST_PROXY);
  app.setGlobalPrefix('api');
  // The API is data, not content: keep it out of search and answer engines.
  app.use(
    (
      _request: unknown,
      response: { setHeader: (key: string, value: string) => void },
      next: () => void,
    ) => {
      response.setHeader('X-Robots-Tag', 'noindex, nofollow');
      next();
    },
  );
  app.use(
    helmet({
      contentSecurityPolicy: isProduction,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());
  app.use((request: Request, response: Response, next: NextFunction) => {
    const requestId = request.header('x-request-id') ?? randomUUID();
    response.setHeader('x-request-id', requestId);
    Object.assign(request, { requestId });
    next();
  });
  app.enableCors({
    origin: isProduction ? origins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ZodExceptionFilter());
  app.enableShutdownHooks();

  const openApi = new DocumentBuilder()
    .setTitle(`${config.APP_NAME} API`)
    .setDescription('Account, gameplay, progression, social and administration API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, openApi), {
    customSiteTitle: `${config.APP_NAME} API`,
  });

  await app.listen(config.PORT, '0.0.0.0');
  logger.log(`${config.APP_NAME} API listening on port ${config.PORT} (${config.NODE_ENV})`);
}

void bootstrap().catch((error: unknown) => {
  // Configuration errors must be loud and fatal rather than a half-booted service.
  console.error('API failed to start:', error);
  process.exit(1);
});
