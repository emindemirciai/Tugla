import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { createPrismaClient, type Prisma, type UserRole, type PrismaClient } from '@tugla/database';
import type { Request } from 'express';
import Redis from 'ioredis';
import { env } from '../config/env';

export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);

export interface AccessClaims {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access';
  sid: string;
}

export interface AuthenticatedRequest extends Request {
  user: AccessClaims;
  requestId?: string;
}

/**
 * Prisma client wired through the pg driver adapter so the API runs on
 * environments where Prisma's native engine binaries are unavailable.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  readonly client: PrismaClient = createPrismaClient({ connectionString: env().DATABASE_URL });

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}

/** Convenience alias so modules read naturally: `this.db.user.findMany()`. */
export type Db = PrismaClient;

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;
  private lastError: string | null = null;

  constructor() {
    this.client = new Redis(env().REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    this.client.on('error', (error: Error) => {
      this.lastError = error.message;
    });
  }

  async ensureConnected() {
    if (this.client.status === 'wait' || this.client.status === 'end') await this.client.connect();
    return this.client;
  }

  /** Redis is a cache/rate-limit store, never the source of truth. */
  async safe<T>(operation: (client: Redis) => Promise<T>): Promise<T | null> {
    try {
      return await operation(await this.ensureConnected());
    } catch (error) {
      this.lastError = (error as Error).message;
      return null;
    }
  }

  /**
   * Fixed-window counter used for per-identity throttling of sensitive
   * endpoints. Returns the current count, or null when Redis is unavailable.
   */
  async increment(key: string, windowSeconds: number) {
    return this.safe(async (client) => {
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, windowSeconds);
      return count;
    });
  }

  get status() {
    return { status: this.client.status, lastError: this.lastError };
  }

  async onModuleDestroy() {
    if (this.client.status !== 'end') this.client.disconnect();
  }
}

@Injectable()
export class JwtStrategyService {
  constructor(private readonly jwt: JwtService) {}

  sign(claims: AccessClaims) {
    return this.jwt.signAsync(claims, {
      secret: env().JWT_ACCESS_SECRET,
      expiresIn: env().ACCESS_TOKEN_TTL,
    });
  }

  verify(token: string) {
    return this.jwt.verifyAsync<AccessClaims>(token, {
      secret: env().JWT_ACCESS_SECRET,
      issuer: `${env().APP_SLUG}-api`,
      audience: `${env().APP_SLUG}-client`,
    });
  }
}

/**
 * Authenticates the bearer token and enforces role requirements.
 *
 * Beyond signature validation it re-checks the account status on every request
 * so bans and deletions take effect immediately rather than at token expiry.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly strategy: JwtStrategyService,
    private readonly database: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>('public', [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.header('authorization');

    if (isPublic) {
      if (header?.startsWith('Bearer ')) {
        try {
          request.user = await this.strategy.verify(header.slice(7));
        } catch {
          /* optional identity on public routes */
        }
      }
      return true;
    }

    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Authentication required');

    let claims: AccessClaims;
    try {
      claims = await this.strategy.verify(header.slice(7));
      if (claims.type !== 'access') throw new Error('Wrong token type');
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const user = await this.database.client.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, role: true, status: true, bannedUntil: true },
    });
    if (!user || user.status === 'DELETED') throw new UnauthorizedException('Account unavailable');
    if (user.status === 'SUSPENDED') {
      if (!user.bannedUntil || user.bannedUntil > new Date()) {
        throw new ForbiddenException('Account is suspended');
      }
      await this.database.client.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', bannedUntil: null },
      });
    }

    request.user = { ...claims, role: user.role };
    const allowed = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed?.length && !allowed.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}

/** Records an administrative action for the immutable audit trail. */
@Injectable()
export class AuditService {
  constructor(private readonly database: DatabaseService) {}

  record(input: {
    actorId?: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    before?: unknown;
    after?: unknown;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
  }) {
    return this.database.client.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        before: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        requestId: input.requestId,
      },
    });
  }

  fromRequest(
    request: AuthenticatedRequest,
    action: string,
    targetType: string,
    targetId?: string | null,
    before?: unknown,
    after?: unknown,
  ) {
    return this.record({
      actorId: request.user?.sub ?? null,
      action,
      targetType,
      targetId,
      before,
      after,
      ipAddress: request.ip,
      userAgent: request.header('user-agent'),
      requestId: request.requestId,
    });
  }
}

/**
 * Feature flags and remote configuration.
 *
 * Values live in PostgreSQL and are cached in Redis for a short window so the
 * game client can poll cheaply while admins still see changes take effect fast.
 */
@Injectable()
export class FeatureFlagService {
  private readonly cacheKey = 'feature-flags:v1';
  private memory: {
    value: Record<string, { enabled: boolean; config: unknown }>;
    expires: number;
  } | null = null;

  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  async all() {
    if (this.memory && this.memory.expires > Date.now()) return this.memory.value;
    const cached = await this.redis.safe((client) => client.get(this.cacheKey));
    if (cached) {
      const value = JSON.parse(cached) as Record<string, { enabled: boolean; config: unknown }>;
      this.memory = { value, expires: Date.now() + 15_000 };
      return value;
    }
    const flags = await this.database.client.featureFlag.findMany();
    const value = Object.fromEntries(
      flags.map((flag) => [flag.key, { enabled: flag.enabled, config: flag.config ?? null }]),
    );
    await this.redis.safe((client) => client.set(this.cacheKey, JSON.stringify(value), 'EX', 30));
    this.memory = { value, expires: Date.now() + 15_000 };
    return value;
  }

  async isEnabled(key: string, fallback = false) {
    const flags = await this.all();
    return flags[key]?.enabled ?? fallback;
  }

  async invalidate() {
    this.memory = null;
    await this.redis.safe((client) => client.del(this.cacheKey));
  }
}
