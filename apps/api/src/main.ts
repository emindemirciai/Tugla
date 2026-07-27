import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const isProduction = process.env.NODE_ENV === 'production';
  const webOrigins = [process.env.WEB_URL, process.env.ADMIN_URL].filter(Boolean) as string[];

  app.setGlobalPrefix('api');
  app.use(
    helmet({
      contentSecurityPolicy: isProduction,
      crossOriginEmbedderPolicy: false,
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
    origin: isProduction ? webOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  const openApi = new DocumentBuilder()
    .setTitle(`${process.env.APP_NAME ?? 'Tuğla'} API`)
    .setDescription('Account, game session, social, competition and administration API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, openApi);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: `${process.env.APP_NAME ?? 'Tuğla'} API`,
  });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
