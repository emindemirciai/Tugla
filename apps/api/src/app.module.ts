import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminContentController } from './admin/content.controller';
import { AdminOperationsController, AdminSystemController } from './admin/operations.controller';
import { env } from './config/env';
import { AuthController, AuthService } from './modules/auth';
import { CommunityService, GameController, GameService } from './modules/game';
import { PlatformController, PlatformService } from './modules/platform';
import { ProgressionController, ProgressionService } from './modules/progression';
import { SocialController, SocialService } from './modules/social';
import {
  AccessGuard,
  AuditService,
  DatabaseService,
  FeatureFlagService,
  JwtStrategyService,
  RedisService,
} from './services/core';
import { MailService } from './services/mail';
import { StorageService } from './services/storage';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'burst',
        ttl: env().RATE_LIMIT_BURST_SECONDS * 1000,
        limit: env().RATE_LIMIT_BURST,
      },
      {
        name: 'sustained',
        ttl: env().RATE_LIMIT_SUSTAINED_SECONDS * 1000,
        limit: env().RATE_LIMIT_SUSTAINED,
      },
    ]),
    JwtModule.register({
      global: true,
      secret: env().JWT_ACCESS_SECRET,
      signOptions: {
        issuer: `${env().APP_SLUG}-api`,
        audience: `${env().APP_SLUG}-client`,
        expiresIn: env().ACCESS_TOKEN_TTL,
      },
    }),
  ],
  controllers: [
    AuthController,
    GameController,
    ProgressionController,
    SocialController,
    PlatformController,
    AdminContentController,
    AdminOperationsController,
    AdminSystemController,
  ],
  providers: [
    DatabaseService,
    RedisService,
    JwtStrategyService,
    AuditService,
    FeatureFlagService,
    MailService,
    StorageService,
    AuthService,
    GameService,
    CommunityService,
    ProgressionService,
    SocialService,
    PlatformService,
    { provide: APP_GUARD, useClass: AccessGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(_consumer: MiddlewareConsumer) {
    // Request-id and security middleware are applied in main.ts before routing.
  }
}
