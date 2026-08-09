import './config/load-dotenv';
import 'reflect-metadata';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
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
  // Replay payloads are the largest thing this API accepts: a long game records
  // thousands of paddle inputs, and the default 100 kB body limit rejected them
  // with 413 — the score was lost and the level never counted as finished.
  // Configured through Nest so express stays a transitive dependency.
  app.useBodyParser('json', { limit: '8mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });
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

  if (config.SEED_ON_DEPLOY) seedContent(logger);
}

/**
 * Refreshes generated content (campaign levels, catalogue) after boot.
 *
 * Seeding used to be a separate one-shot container in the compose file. A
 * container that exits is easy for a deploy pipeline to read as a failed
 * release, and a release must never be at the mercy of content seeding — so the
 * job moved here: it starts *after* the server is already listening, its output
 * is logged, and a failure is reported without touching the running service.
 * The seed is an upsert, so accounts, progress and scores are untouched.
 */
function seedContent(logger: Logger) {
  logger.log('Seeding generated content (SEED_ON_DEPLOY=true)…');
  // Run the seed with the node binary already in this process and tsx from
  // node_modules, rather than through pnpm. The API container is read-only and
  // unprivileged, so anything that makes corepack fetch or write at runtime is
  // avoidable risk; node executing a file needs neither.
  const repoRoot = resolve(__dirname, '../../..');
  const seed = spawn(
    process.execPath,
    [
      require.resolve('tsx/cli', { paths: [repoRoot] }),
      resolve(repoRoot, 'packages/database/prisma/seed.ts'),
    ],
    { cwd: repoRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let output = '';
  seed.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
  seed.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
  seed.on('error', (error) => logger.error(`Content seeding could not start: ${error.message}`));
  seed.on('close', (code) => {
    if (code === 0) logger.log('Content seeding finished.');
    else logger.error(`Content seeding failed with code ${code}: ${output.trim().slice(-800)}`);
  });
}

void bootstrap().catch((error: unknown) => {
  // Configuration errors must be loud and fatal rather than a half-booted
  // service — and they must say *which* variable is wrong. A rotated secret
  // that is one character too short used to print a raw Zod object into the
  // container log, which reads as "the API just died".
  const issues = (error as { issues?: { path: (string | number)[]; message: string }[] }).issues;
  if (Array.isArray(issues)) {
    console.error('API failed to start: the environment is not valid.\n');
    for (const issue of issues) {
      console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    console.error(
      '\nCheck these values in the deployment environment. Secrets must satisfy their minimum' +
        ' length: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET and SESSION_ENCRYPTION_KEY need at least' +
        ' 32 characters, INTERNAL_API_KEY at least 16.',
    );
  } else {
    console.error('API failed to start:', error);
  }
  process.exit(1);
});
