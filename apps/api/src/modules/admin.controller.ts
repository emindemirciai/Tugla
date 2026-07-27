import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Prisma, UserRole } from '@pulse/database';
import { levelDefinitionSchema } from '@pulse/shared';
import { z } from 'zod';
import { AccessGuard, type AuthenticatedRequest, DatabaseService, Roles } from '../services/core';

const moderationSchema = z.object({
  status: z.enum(['REVIEWING', 'ACTIONED', 'DISMISSED']),
  resolution: z.string().max(2_000).optional(),
});

@UseGuards(AccessGuard)
@Roles(UserRole.CONTENT_EDITOR, UserRole.GAME_ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly database: DatabaseService) {}

  @Get('overview')
  async overview() {
    const [users, sessions, levels, openReports, tickets] = await this.database.$transaction([
      this.database.user.count({ where: { status: 'ACTIVE' } }),
      this.database.gameSession.count({
        where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } },
      }),
      this.database.level.count({ where: { status: 'PUBLISHED' } }),
      this.database.moderationReport.count({
        where: { status: { in: ['OPEN', 'REVIEWING'] } },
      }),
      this.database.supportTicket.count({
        where: { status: { in: ['OPEN', 'INVESTIGATING'] } },
      }),
    ]);
    return {
      users,
      sessions24h: sessions,
      publishedLevels: levels,
      openReports,
      openTickets: tickets,
    };
  }

  @Get('levels')
  async levels() {
    return {
      items: await this.database.level.findMany({
        orderBy: [{ world: 'asc' }, { index: 'asc' }],
        take: 1_000,
      }),
    };
  }

  @Post('levels')
  async createLevel(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const definition = levelDefinitionSchema.parse(body);
    const level = await this.database.level.create({
      data: {
        slug: `level-${definition.world}-${definition.index}-${Date.now().toString(36)}`,
        name: definition.name,
        world: definition.world,
        index: definition.index,
        type: definition.type,
        theme: definition.theme,
        definition: definition as Prisma.InputJsonValue,
        authorId: request.user.sub,
        status: 'DRAFT',
        versions: {
          create: {
            version: 1,
            definition: definition as Prisma.InputJsonValue,
            createdBy: request.user.sub,
          },
        },
      },
    });
    await this.audit(request, 'LEVEL_CREATE', 'Level', level.id, null, definition);
    return level;
  }

  @Patch('levels/:id')
  async updateLevel(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const definition = levelDefinitionSchema.parse(body);
    const current = await this.database.level.findUnique({
      where: { id },
      include: { versions: true },
    });
    if (!current) throw new NotFoundException('Level not found');
    const version = Math.max(0, ...current.versions.map((item) => item.version)) + 1;
    const level = await this.database.$transaction(async (database) => {
      await database.levelVersion.create({
        data: {
          levelId: id,
          version,
          definition: definition as Prisma.InputJsonValue,
          createdBy: request.user.sub,
        },
      });
      return database.level.update({
        where: { id },
        data: {
          name: definition.name,
          world: definition.world,
          index: definition.index,
          type: definition.type,
          theme: definition.theme,
          definition: definition as Prisma.InputJsonValue,
        },
      });
    });
    await this.audit(request, 'LEVEL_UPDATE', 'Level', id, current.definition, definition);
    return level;
  }

  @Post('levels/:id/publish')
  @Roles(UserRole.GAME_ADMIN, UserRole.SUPER_ADMIN)
  async publish(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const level = await this.database.level.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    await this.audit(request, 'LEVEL_PUBLISH', 'Level', id, null, {
      status: 'PUBLISHED',
    });
    return level;
  }

  @Delete('levels/:id')
  @Roles(UserRole.GAME_ADMIN, UserRole.SUPER_ADMIN)
  async archive(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const level = await this.database.level.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
    await this.audit(request, 'LEVEL_ARCHIVE', 'Level', id, null, {
      status: 'ARCHIVED',
    });
    return level;
  }

  @Get('reports')
  async reports() {
    return {
      items: await this.database.moderationReport.findMany({
        orderBy: { createdAt: 'asc' },
        take: 200,
      }),
    };
  }

  @Patch('reports/:id')
  @Roles(UserRole.SUPPORT, UserRole.GAME_ADMIN, UserRole.SUPER_ADMIN)
  async moderate(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const data = moderationSchema.parse(body);
    const report = await this.database.moderationReport.update({
      where: { id },
      data,
    });
    await this.audit(request, 'REPORT_MODERATE', 'ModerationReport', id, null, data);
    return report;
  }

  private audit(
    request: AuthenticatedRequest,
    action: string,
    targetType: string,
    targetId: string,
    before: unknown,
    after: unknown,
  ) {
    return this.database.auditLog.create({
      data: {
        actorId: request.user.sub,
        action,
        targetType,
        targetId,
        before: before as object | undefined,
        after: after as object | undefined,
        ipAddress: request.ip,
        userAgent: request.header('user-agent'),
        requestId: request.requestId,
      },
    });
  }
}
