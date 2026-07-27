import { Body, Controller, Get, Injectable, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Prisma } from '@tugla/database';
import { z } from 'zod';
import {
  AccessGuard,
  type AuthenticatedRequest,
  DatabaseService,
  Public,
  RedisService,
} from '../services/core';

const supportSchema = z.object({
  email: z.string().email(),
  category: z.string().min(2).max(40),
  subject: z.string().min(3).max(120),
  body: z.string().min(10).max(5_000),
  deviceInfo: z.record(z.unknown()).optional(),
});

@Injectable()
export class PlatformService {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  async health() {
    await this.database.$queryRaw`SELECT 1`;
    let redis = 'down';
    try {
      redis = (await (await this.redis.ensureConnected()).ping()) === 'PONG' ? 'up' : 'down';
    } catch {
      redis = 'down';
    }
    return {
      status: redis === 'up' ? 'ok' : 'degraded',
      database: 'up',
      redis,
      time: new Date().toISOString(),
    };
  }
}

@Controller()
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly database: DatabaseService,
  ) {}

  @Public()
  @Get('health')
  health() {
    return this.platform.health();
  }

  @UseGuards(AccessGuard)
  @Get('meta/tasks')
  async tasks(@Req() request: AuthenticatedRequest) {
    const items = await this.database.taskDefinition.findMany({
      where: { active: true },
      include: {
        progress: {
          where: { userId: request.user.sub },
          take: 1,
        },
      },
    });
    return { items };
  }

  @UseGuards(AccessGuard)
  @Get('meta/achievements')
  async achievements(@Req() request: AuthenticatedRequest) {
    const items = await this.database.achievement.findMany({
      where: { active: true },
      include: { unlocks: { where: { userId: request.user.sub }, take: 1 } },
    });
    return { items };
  }

  @UseGuards(AccessGuard)
  @Get('meta/catalog')
  async catalog() {
    return {
      items: await this.database.catalogItem.findMany({ where: { active: true } }),
    };
  }

  @Public()
  @Post('support')
  async support(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const data = supportSchema.parse(body);
    return this.database.supportTicket.create({
      data: {
        ...data,
        userId: request.user?.sub,
        deviceInfo: data.deviceInfo as Prisma.InputJsonValue | undefined,
      },
      select: { id: true, status: true, createdAt: true },
    });
  }

  @UseGuards(AccessGuard)
  @Post('notifications/:id/read')
  readNotification(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.database.notification.update({
      where: { id, userId: request.user.sub },
      data: { readAt: new Date() },
    });
  }
}
