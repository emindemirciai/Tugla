import { Body, Controller, Get, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type Prisma } from '@tugla/database';
import {
  APP_DEFAULTS,
  moderationReportSchema,
  pageSchema,
  purchaseIntentSchema,
  qualityLevels,
  supportTicketSchema,
} from '@tugla/shared';
import { z } from 'zod';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { env, providerStatus } from '../config/env';
import {
  DatabaseService,
  FeatureFlagService,
  Public,
  RedisService,
  type AuthenticatedRequest,
} from '../services/core';
import { MailService } from '../services/mail';
import { StorageService } from '../services/storage';
import { ProgressionService } from './progression';

const deviceSchema = z.object({
  fingerprint: z.string().min(8).max(128),
  name: z.string().min(1).max(60),
  platform: z.enum(['web', 'pwa', 'android', 'ios']),
  pushToken: z.string().max(400).optional(),
});

const settingsSchema = z.object({
  quality: z.enum(qualityLevels).optional(),
  reducedMotion: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  hapticsEnabled: z.boolean().optional(),
});

@Injectable()
export class PlatformService {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly mail: MailService,
    private readonly flags: FeatureFlagService,
  ) {}

  /** Liveness/readiness for load balancers, Docker and Dokploy. */
  async health() {
    const started = Date.now();
    let database = 'down';
    try {
      await this.database.client.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }
    const redis =
      (await this.redis.safe(async (client) => client.ping())) === 'PONG' ? 'up' : 'down';
    const status = database === 'up' ? (redis === 'up' ? 'ok' : 'degraded') : 'error';
    return {
      status,
      database,
      redis,
      storage: this.storage.available ? this.storage.provider : 'unavailable',
      mail: this.mail.enabled ? env().MAIL_PROVIDER : 'disabled',
      latencyMs: Date.now() - started,
      version: process.env.APP_VERSION ?? '1.0.0',
      time: new Date().toISOString(),
    };
  }

  /** Client bootstrap: branding, limits, enabled providers and feature flags. */
  async remoteConfig() {
    const config = env();
    return {
      brand: {
        name: config.APP_NAME,
        slug: config.APP_SLUG,
        webUrl: config.WEB_URL,
        supportEmail: `support@${config.ROOT_DOMAIN}`,
      },
      limits: {
        maxBalls: APP_DEFAULTS.maxBalls,
        livesPerLevel: APP_DEFAULTS.livesPerLevel,
        worlds: APP_DEFAULTS.worlds,
        levelsPerWorld: APP_DEFAULTS.levelsPerWorld,
      },
      providers: providerStatus(config),
      flags: await this.flags.all(),
    };
  }
}

@ApiTags('platform')
@Controller()
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly database: DatabaseService,
    private readonly progression: ProgressionService,
  ) {}

  private get db() {
    return this.database.client;
  }

  @Public()
  @Get('health')
  health() {
    return this.platform.health();
  }

  @Public()
  @Get('config')
  config() {
    return this.platform.remoteConfig();
  }

  @Public()
  @Get('announcements')
  async announcements() {
    const now = new Date();
    const items = await this.db.announcement.findMany({
      where: {
        publishedAt: { not: null, lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      orderBy: { publishedAt: 'desc' },
      take: 10,
      select: { id: true, title: true, body: true, publishedAt: true, audience: true },
    });
    return { items };
  }

  @Get('notifications')
  async notifications(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const page = pageSchema.parse(query);
    const items = await this.db.notification.findMany({
      where: { userId: request.user.sub },
      orderBy: { createdAt: 'desc' },
      take: page.limit,
    });
    const unread = await this.db.notification.count({
      where: { userId: request.user.sub, readAt: null },
    });
    return { items, unread };
  }

  @Post('notifications/:id/read')
  async readNotification(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const updated = await this.db.notification.updateMany({
      where: { id, userId: request.user.sub },
      data: { readAt: new Date() },
    });
    if (!updated.count) throw new NotFoundException('Notification not found');
    return { ok: true };
  }

  @Post('notifications/read-all')
  async readAll(@Req() request: AuthenticatedRequest) {
    const updated = await this.db.notification.updateMany({
      where: { userId: request.user.sub, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: updated.count };
  }

  /** Registers or refreshes a device so multi-device sync stays accurate. */
  @Post('devices')
  async registerDevice(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const data = deviceSchema.parse(body);
    return this.db.device.upsert({
      where: { userId_fingerprint: { userId: request.user.sub, fingerprint: data.fingerprint } },
      update: {
        name: data.name,
        platform: data.platform,
        pushToken: data.pushToken,
        lastSeenAt: new Date(),
      },
      create: { ...data, userId: request.user.sub },
      select: { id: true, name: true, platform: true, lastSeenAt: true },
    });
  }

  @Get('devices')
  async devices(@Req() request: AuthenticatedRequest) {
    return {
      items: await this.db.device.findMany({
        where: { userId: request.user.sub },
        orderBy: { lastSeenAt: 'desc' },
        select: { id: true, name: true, platform: true, lastSeenAt: true, createdAt: true },
      }),
    };
  }

  /**
   * Cloud save. Client settings live on the progress row's metadata-free
   * columns; conflicting writes are resolved by version, last-writer-wins only
   * when versions match so offline play cannot silently clobber newer data.
   */
  @Post('sync')
  async sync(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const data = z
      .object({
        version: z.number().int().nonnegative(),
        settings: settingsSchema.optional(),
        offlineSessions: z
          .array(
            z.object({
              levelId: z.string().uuid(),
              score: z.number().int().nonnegative().max(100_000_000),
              completed: z.boolean(),
              playedAt: z.string().datetime(),
            }),
          )
          .max(50)
          .optional(),
      })
      .parse(body);

    const progress = await this.db.userProgress.findUniqueOrThrow({
      where: { userId: request.user.sub },
    });
    if (data.version > progress.version) {
      throw new BadRequestException('Client version is ahead of the server; refresh first');
    }
    const stale = data.version < progress.version;

    // Offline runs are recorded for continuity but never scored: they cannot be
    // verified, so they do not touch leaderboards or currency.
    let recorded = 0;
    if (data.offlineSessions?.length && !stale) {
      for (const offline of data.offlineSessions) {
        const level = await this.db.level.findUnique({ where: { id: offline.levelId } });
        if (!level) continue;
        await this.db.gameSession.create({
          data: {
            userId: request.user.sub,
            levelId: level.id,
            mode: 'CAMPAIGN',
            status: offline.completed ? 'COMPLETED' : 'FAILED',
            seed: 0,
            signedNonce: `offline-${request.user.sub}-${offline.levelId}-${offline.playedAt}`,
            score: offline.score,
            riskScore: 100,
            startedAt: new Date(offline.playedAt),
            finishedAt: new Date(offline.playedAt),
          },
        });
        if (offline.completed) {
          await this.db.userProgress.update({
            where: { userId: request.user.sub },
            data: { currentLevel: Math.max(progress.currentLevel, level.index + 1) },
          });
        }
        recorded += 1;
      }
    }

    const fresh = await this.db.userProgress.findUniqueOrThrow({
      where: { userId: request.user.sub },
    });
    return { stale, progress: fresh, offlineSessionsRecorded: recorded };
  }

  @Public()
  @Post('support')
  async support(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const data = supportTicketSchema.parse(body);
    return this.db.supportTicket.create({
      data: {
        ...data,
        userId: request.user?.sub,
        deviceInfo: data.deviceInfo as Prisma.InputJsonValue | undefined,
      },
      select: { id: true, status: true, createdAt: true },
    });
  }

  @Get('support/tickets')
  async myTickets(@Req() request: AuthenticatedRequest) {
    return {
      items: await this.db.supportTicket.findMany({
        where: { userId: request.user.sub },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, subject: true, category: true, status: true, createdAt: true },
      }),
    };
  }

  /** Number of distinct open reports that pulls a published level back into review. */
  static readonly AUTO_REVIEW_THRESHOLD = 3;

  @Post('reports')
  async report(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const data = moderationReportSchema.parse(body);

    // One open report per person per target: repeat clicks must not inflate the
    // queue or trip the auto-review threshold on their own.
    const existing = await this.db.moderationReport.findFirst({
      where: {
        reporterId: request.user.sub,
        targetType: data.targetType,
        targetId: data.targetId,
        status: { in: ['OPEN', 'REVIEWING'] },
      },
      select: { id: true, status: true, createdAt: true },
    });
    if (existing) return { ...existing, duplicate: true };

    const created = await this.db.moderationReport.create({
      data: { ...data, reporterId: request.user.sub },
      select: { id: true, status: true, createdAt: true },
    });

    // Community content is user-generated: once enough distinct players report a
    // published level it is pulled back into review automatically instead of
    // waiting for a moderator to notice.
    if (data.targetType === 'LEVEL') {
      const open = await this.db.moderationReport.count({
        where: {
          targetType: 'LEVEL',
          targetId: data.targetId,
          status: { in: ['OPEN', 'REVIEWING'] },
        },
      });
      if (open >= PlatformController.AUTO_REVIEW_THRESHOLD) {
        const level = await this.db.level.findFirst({
          where: { id: data.targetId, type: 'COMMUNITY', status: 'PUBLISHED' },
          select: { id: true, name: true },
        });
        if (level) {
          await this.db.level.update({ where: { id: level.id }, data: { status: 'REVIEW' } });
          await this.db.auditLog.create({
            data: {
              actorId: null,
              action: 'LEVEL_AUTO_REVIEW',
              targetType: 'LEVEL',
              targetId: level.id,
              after: { reports: open, name: level.name },
            },
          });
          return { ...created, autoHidden: true };
        }
      }
    }

    return { ...created, duplicate: false };
  }

  /** Shop catalogue. Real-money SKUs are hidden until payments are configured. */
  @Get('shop')
  async shop() {
    const providers = providerStatus();
    const items = await this.db.catalogItem.findMany({ where: { active: true } });
    return {
      items: items.filter((item) => item.currency !== null || providers.payments),
      paymentsEnabled: providers.payments,
    };
  }

  @Post('shop/purchase')
  async purchase(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const data = purchaseIntentSchema.parse(body);
    const item = await this.db.catalogItem.findFirst({ where: { sku: data.sku, active: true } });
    if (!item) throw new NotFoundException('Item not found');
    if (item.currency === null || item.price === null) {
      throw new BadRequestException(
        'This item requires a real-money payment provider, which is not configured',
      );
    }
    const owned = await this.db.inventoryItem.findUnique({
      where: { userId_itemId: { userId: request.user.sub, itemId: item.id } },
    });
    if (owned) throw new BadRequestException('Item already owned');

    await this.db.$transaction(async (tx) => {
      await this.progression.adjustWallet(
        tx,
        request.user.sub,
        item.currency!,
        -item.price!,
        'SHOP_PURCHASE',
        item.sku,
      );
      await tx.inventoryItem.create({ data: { userId: request.user.sub, itemId: item.id } });
    });
    return { purchased: true, sku: item.sku };
  }

  @Get('inventory')
  async inventory(@Req() request: AuthenticatedRequest) {
    return {
      items: await this.db.inventoryItem.findMany({
        where: { userId: request.user.sub },
        include: { item: true },
      }),
    };
  }

  @Post('inventory/:id/equip')
  async equip(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const entry = await this.db.inventoryItem.findFirst({
      where: { id, userId: request.user.sub },
      include: { item: true },
    });
    if (!entry) throw new NotFoundException('Item not owned');
    await this.db.$transaction([
      this.db.inventoryItem.updateMany({
        where: { userId: request.user.sub, item: { category: entry.item.category } },
        data: { equipped: false },
      }),
      this.db.inventoryItem.update({ where: { id }, data: { equipped: true } }),
    ]);
    return { equipped: true };
  }
}
