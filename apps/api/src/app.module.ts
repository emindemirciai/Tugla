import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminController } from './modules/admin.controller';
import { AuthController, AuthService } from './modules/auth';
import { GameController, GameService } from './modules/game';
import { PlatformController, PlatformService } from './modules/platform';
import { SocialController, SocialService } from './modules/social';
import { AccessGuard, DatabaseService, JwtStrategyService, RedisService } from './services/core';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 12 },
      { name: 'long', ttl: 60_000, limit: 120 },
    ]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_ACCESS_SECRET ?? 'development-access-secret-change-me',
      signOptions: { issuer: 'pulse-api', audience: 'pulse-client', expiresIn: '15m' },
    }),
  ],
  controllers: [
    AuthController,
    GameController,
    SocialController,
    PlatformController,
    AdminController,
  ],
  providers: [
    DatabaseService,
    RedisService,
    JwtStrategyService,
    AccessGuard,
    AuthService,
    GameService,
    SocialService,
    PlatformService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
