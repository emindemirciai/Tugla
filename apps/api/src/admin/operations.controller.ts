import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma, UserRole, UserStatus } from '@tugla/database';
import { pageSchema, userRoles } from '@tugla/shared';
import { z } from 'zod';
import { env, providerStatus } from '../config/env';
import {
  AuditService,
  DatabaseService,
  RedisService,
  Roles,
  type AuthenticatedRequest,
} from '../services/core';
import { MailService } from '../services/mail';
import { StorageService } from '../services/storage';
import { ProgressionService } from '../modules/progression';

const banSchema = z.object({
  reason: z.string().min(3).max(300),
  days: z.number().int().min(1).max(3650).nullable(),
});

const grantSchema = z.object({
  currency: z.enum(['CREDITS', 'CRYSTALS']),
  amount: z.number().int().min(-1_000_000).max(1_000_000),
  reason: z.string().min(3).max(200),
});

/** Player operations: users, bans, moderation, support, economy grants. */
@ApiTags('admin/operations')
@Roles(UserRole.SUPPORT, UserRole.ANALYST, UserRole.GAME_ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/operations')
export class AdminOperationsController {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    private readonly progression: ProgressionService,
  ) {}

  private get db() {
    return this.database.client;
  }

  @Get('users')
  async users(@Query() query: unknown) {
    const filters = z
      .object({
        search: z.string().max(80).optional(),
        status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
        role: z.enum(userRoles).optional(),
        skip: z.coerce.number().int().min(0).default(0),
      })
      .parse(query);
    const page = pageSchema.parse(query);
    const where: Prisma.UserWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.search
        ? {
            OR: [
              { email: { contains: filters.search, mode: 'insensitive' } },
              { username: { contains: filters.search, mode: 'insensitive' } },
              { displayName: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filters.skip,
        take: page.limit,
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          role: true,
          status: true,
          riskScore: true,
          bannedUntil: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
      }),
      this.db.user.count({ where }),
    ]);
    return { items, total, skip: filters.skip, limit: page.limit };
  }

  @Get('users/:id')
  async user(@Param('id') id: string) {
    const user = await this.db.user.findUnique({
      where: { id },
      include: {
        progress: true,
        balances: true,
        accounts: { select: { provider: true, createdAt: true } },
        devices: { select: { id: true, name: true, platform: true, lastSeenAt: true } },
        _count: { select: { gameSessions: true, authoredLevels: true, supportTickets: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const [recentSessions, flagged, transactions] = await Promise.all([
      this.db.gameSession.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          score: true,
          status: true,
          riskScore: true,
          createdAt: true,
          level: { select: { name: true, world: true, index: true } },
        },
      }),
      this.db.gameSession.count({ where: { userId: id, status: 'FLAGGED' } }),
      this.db.walletTransaction.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    const { passwordHash: _p, twoFactorSecret: _s, ...safe } = user;
    return { user: safe, recentSessions, flaggedSessions: flagged, transactions };
  }

  @Post('users/:id/ban')
  @Roles(UserRole.GAME_ADMIN, UserRole.SUPER_ADMIN)
  async ban(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const data = banSchema.parse(body);
    if (id === request.user.sub) throw new BadRequestException('You cannot ban your own account');
    const user = await this.db.user.update({
      where: { id },
      data: {
        status: UserStatus.SUSPENDED,
        banReason: data.reason,
        bannedUntil: data.days ? new Date(Date.now() + data.days * 86_400_000) : null,
      },
      select: { id: true, status: true, bannedUntil: true, banReason: true },
    });
    await this.db.refreshSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.db.notification.create({
      data: {
        userId: id,
        type: 'ACCOUNT_SUSPENDED',
        title: 'Your account has been suspended',
        body: data.reason,
      },
    });
    await this.audit.fromRequest(request, 'USER_BAN', 'User', id, null, data);
    return user;
  }

  @Post('users/:id/unban')
  @Roles(UserRole.GAME_ADMIN, UserRole.SUPER_ADMIN)
  async unban(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const user = await this.db.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE, bannedUntil: null, banReason: null },
      select: { id: true, status: true },
    });
    await this.audit.fromRequest(request, 'USER_UNBAN', 'User', id);
    return user;
  }

  @Patch('users/:id/role')
  @Roles(UserRole.SUPER_ADMIN)
  async setRole(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const data = z.object({ role: z.enum(userRoles) }).parse(body);
    if (id === request.user.sub) throw new BadRequestException('You cannot change your own role');
    const user = await this.db.user.update({
      where: { id },
      data: { role: data.role as UserRole },
      select: { id: true, role: true },
    });
    await this.audit.fromRequest(request, 'USER_ROLE', 'User', id, null, data);
    return user;
  }

  @Post('users/:id/grant')
  @Roles(UserRole.GAME_ADMIN, UserRole.SUPER_ADMIN)
  async grant(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const data = grantSchema.parse(body);
    await this.db.$transaction(async (tx) => {
      await this.progression.adjustWallet(
        tx,
        id,
        data.currency,
        data.amount,
        `ADMIN_GRANT:${data.reason}`.slice(0, 120),
        request.user.sub,
      );
    });
    await this.audit.fromRequest(request, 'ECONOMY_GRANT', 'User', id, null, data);
    return { granted: true };
  }

  @Get('reports')
  async reports(@Query() query: unknown) {
    const filters = z
      .object({ status: z.enum(['OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED']).optional() })
      .parse(query);
    const items = await this.db.moderationReport.findMany({
      where: filters.status ? { status: filters.status } : {},
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { reporter: { select: { id: true, username: true } } },
    });
    return { items };
  }

  @Patch('reports/:id')
  async moderate(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const data = z
      .object({
        status: z.enum(['REVIEWING', 'ACTIONED', 'DISMISSED']),
        resolution: z.string().max(2000).optional(),
      })
      .parse(body);
    const report = await this.db.moderationReport.update({ where: { id }, data });
    await this.audit.fromRequest(request, 'REPORT_MODERATE', 'ModerationReport', id, null, data);
    return report;
  }

  @Get('tickets')
  async tickets(@Query() query: unknown) {
    const filters = z
      .object({
        status: z.enum(['OPEN', 'INVESTIGATING', 'WAITING_USER', 'RESOLVED', 'CLOSED']).optional(),
      })
      .parse(query);
    const items = await this.db.supportTicket.findMany({
      where: filters.status ? { status: filters.status } : {},
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { user: { select: { id: true, username: true, email: true } } },
    });
    return { items };
  }

  @Patch('tickets/:id')
  async updateTicket(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const data = z
      .object({
        status: z.enum(['OPEN', 'INVESTIGATING', 'WAITING_USER', 'RESOLVED', 'CLOSED']),
      })
      .parse(body);
    const ticket = await this.db.supportTicket.update({ where: { id }, data });
    await this.audit.fromRequest(request, 'TICKET_UPDATE', 'SupportTicket', id, null, data);
    return ticket;
  }

  /** Sessions flagged by anti-cheat, newest first, with their risk reasons. */
  @Get('flagged-sessions')
  async flaggedSessions(@Query() query: unknown) {
    const page = pageSchema.parse(query);
    const items = await this.db.gameSession.findMany({
      where: { OR: [{ status: 'FLAGGED' }, { riskScore: { gte: 40 } }] },
      orderBy: { createdAt: 'desc' },
      take: page.limit,
      include: {
        user: { select: { id: true, username: true, riskScore: true } },
        level: { select: { name: true, world: true, index: true } },
      },
    });
    return { items };
  }
}

/** System operations: analytics, health, audit trail, provider readiness. */
@ApiTags('admin/system')
@Roles(UserRole.ANALYST, UserRole.GAME_ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/system')
export class AdminSystemController {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly mail: MailService,
  ) {}

  private get db() {
    return this.database.client;
  }

  @Get('overview')
  async overview() {
    const dayAgo = new Date(Date.now() - 86_400_000);
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const [
      users,
      newUsers,
      activeToday,
      sessions24h,
      publishedLevels,
      openReports,
      openTickets,
      flagged,
    ] = await Promise.all([
      this.db.user.count({ where: { status: 'ACTIVE' } }),
      this.db.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.db.gameSession
        .findMany({
          where: { createdAt: { gte: dayAgo } },
          select: { userId: true },
          distinct: ['userId'],
        })
        .then((rows) => rows.length),
      this.db.gameSession.count({ where: { createdAt: { gte: dayAgo } } }),
      this.db.level.count({ where: { status: 'PUBLISHED' } }),
      this.db.moderationReport.count({ where: { status: { in: ['OPEN', 'REVIEWING'] } } }),
      this.db.supportTicket.count({ where: { status: { in: ['OPEN', 'INVESTIGATING'] } } }),
      this.db.gameSession.count({ where: { status: 'FLAGGED', createdAt: { gte: weekAgo } } }),
    ]);
    return {
      users,
      newUsersThisWeek: newUsers,
      activeToday,
      sessions24h,
      publishedLevels,
      openReports,
      openTickets,
      flaggedSessionsThisWeek: flagged,
    };
  }

  /** Daily aggregates for the analytics screen, computed in SQL. */
  @Get('analytics')
  async analytics(@Query() query: unknown) {
    const { days } = z
      .object({ days: z.coerce.number().int().min(1).max(90).default(14) })
      .parse(query);
    const since = new Date(Date.now() - days * 86_400_000);
    const [signups, sessions, revenue] = await Promise.all([
      this.db.$queryRaw<{ day: Date; count: bigint }[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
        FROM "User" WHERE "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1`,
      this.db.$queryRaw<{ day: Date; count: bigint; avg_score: number | null }[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count, AVG("score")::float AS avg_score
        FROM "GameSession" WHERE "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1`,
      this.db.$queryRaw<{ reason: string; total: bigint }[]>`
        SELECT "reason", SUM("amount")::bigint AS total
        FROM "WalletTransaction" WHERE "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
    ]);
    const serialise = <T extends Record<string, unknown>>(rows: T[]) =>
      rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            typeof value === 'bigint' ? Number(value) : value,
          ]),
        ),
      );
    return {
      days,
      signups: serialise(signups),
      sessions: serialise(sessions),
      economy: serialise(revenue),
    };
  }

  @Get('health')
  async health() {
    let database = 'down';
    let latency = 0;
    const started = Date.now();
    try {
      await this.db.$queryRaw`SELECT 1`;
      database = 'up';
      latency = Date.now() - started;
    } catch {
      database = 'down';
    }
    const redisState = this.redis.status;
    const redis =
      (await this.redis.safe(async (client) => client.ping())) === 'PONG' ? 'up' : 'down';
    const [tables] = await this.db.$queryRaw<{ size: string }[]>`
      SELECT pg_size_pretty(pg_database_size(current_database())) AS size`;
    return {
      database: { status: database, latencyMs: latency, size: tables?.size ?? 'unknown' },
      redis: { status: redis, detail: redisState },
      storage: { provider: this.storage.provider, available: this.storage.available },
      mail: { provider: env().MAIL_PROVIDER, enabled: this.mail.enabled },
      providers: providerStatus(),
      process: {
        uptimeSeconds: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        nodeVersion: process.version,
        environment: env().NODE_ENV,
      },
    };
  }

  @Get('audit')
  async audit(@Query() query: unknown) {
    const filters = z
      .object({
        action: z.string().max(60).optional(),
        actorId: z.string().uuid().optional(),
        skip: z.coerce.number().int().min(0).default(0),
      })
      .parse(query);
    const page = pageSchema.parse(query);
    const where: Prisma.AuditLogWhereInput = {
      ...(filters.action ? { action: { contains: filters.action, mode: 'insensitive' } } : {}),
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filters.skip,
        take: page.limit,
        include: { actor: { select: { id: true, username: true, email: true } } },
      }),
      this.db.auditLog.count({ where }),
    ]);
    return { items, total, skip: filters.skip, limit: page.limit };
  }

  @Get('leagues')
  async leagues() {
    const items = await this.db.league.findMany({
      orderBy: { startsAt: 'desc' },
      take: 20,
      include: {
        groups: {
          include: { _count: { select: { members: true } } },
        },
      },
    });
    return {
      items: items.map((league) => ({
        id: league.id,
        key: league.key,
        tier: league.tier,
        startsAt: league.startsAt,
        endsAt: league.endsAt,
        groups: league.groups.length,
        members: league.groups.reduce((total, group) => total + group._count.members, 0),
      })),
    };
  }
}
