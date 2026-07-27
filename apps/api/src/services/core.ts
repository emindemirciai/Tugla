import {
  CanActivate,
  ExecutionContext,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient, UserRole } from '@pulse/database';
import type { Request } from 'express';
import Redis from 'ioredis';

export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);

export interface AccessClaims {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access';
}

export interface AuthenticatedRequest extends Request {
  user: AccessClaims;
  requestId?: string;
}

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    this.client.on('error', () => undefined);
  }

  async ensureConnected() {
    if (this.client.status === 'wait') await this.client.connect();
    return this.client;
  }

  async onModuleDestroy() {
    if (this.client.status !== 'end') this.client.disconnect();
  }
}

@Injectable()
export class JwtStrategyService {
  constructor(private readonly jwt: JwtService) {}

  async verify(token: string) {
    return this.jwt.verifyAsync<AccessClaims>(token, {
      secret: process.env.JWT_ACCESS_SECRET ?? 'development-access-secret-change-me',
      issuer: 'pulse-api',
      audience: 'pulse-client',
    });
  }
}

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly strategy: JwtStrategyService,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>('public', [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.header('authorization');
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Authentication required');
    try {
      const claims = await this.strategy.verify(header.slice(7));
      if (claims.type !== 'access') throw new Error('Wrong token type');
      request.user = claims;
      const allowed = this.reflector.getAllAndOverride<UserRole[]>('roles', [
        context.getHandler(),
        context.getClass(),
      ]);
      return !allowed?.length || allowed.includes(claims.role);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
