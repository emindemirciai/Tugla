import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type Prisma, UserRole } from '@tugla/database';
import { generateCampaignLevel } from '@tugla/game-engine';
import { levelDefinitionSchema, levelStatuses, pageSchema } from '@tugla/shared';
import { z } from 'zod';
import {
  AuditService,
  DatabaseService,
  FeatureFlagService,
  Roles,
  type AuthenticatedRequest,
} from '../services/core';

const levelPayloadSchema = z.object({
  definition: levelDefinitionSchema,
  difficulty: z.number().min(0).max(100).optional(),
  estimatedSeconds: z.number().int().min(10).max(3600).optional(),
  description: z.string().max(500).optional(),
});

const seasonSchema = z.object({
  number: z.number().int().min(1),
  key: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  theme: z.string().min(1).max(40),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  active: z.boolean().default(false),
  rewards: z.record(z.unknown()).default({}),
});

const taskSchema = z.object({
  key: z.string().min(1).max(60),
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(300),
  cadence: z.enum(['DAILY', 'WEEKLY', 'SEASONAL', 'PERMANENT']),
  target: z.number().int().min(1).max(1_000_000),
  eventType: z.string().min(1).max(60),
  rewards: z.record(z.unknown()).default({}),
  active: z.boolean().default(true),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

const achievementSchema = z.object({
  key: z.string().min(1).max(60),
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(300),
  category: z.string().min(1).max(40),
  target: z.number().int().min(1).max(1_000_000),
  eventType: z.string().min(1).max(60),
  rewards: z.record(z.unknown()).default({}),
  hidden: z.boolean().default(false),
  active: z.boolean().default(true),
});

const catalogSchema = z.object({
  sku: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(300),
  category: z.string().min(1).max(40),
  rarity: z.enum(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']),
  currency: z.enum(['CREDITS', 'CRYSTALS']).nullable(),
  price: z.number().int().min(0).max(1_000_000).nullable(),
  metadata: z.record(z.unknown()).default({}),
  active: z.boolean().default(true),
});

const announcementSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(4000),
  audience: z.enum(['ALL', 'PLAYERS', 'STAFF']).default('ALL'),
  publishedAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

/** Content administration: levels, worlds, tasks, achievements, shop, seasons. */
@ApiTags('admin/content')
@Roles(UserRole.CONTENT_EDITOR, UserRole.GAME_ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/content')
export class AdminContentController {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    private readonly flags: FeatureFlagService,
  ) {}

  private get db() {
    return this.database.client;
  }

  // ----- levels ---------------------------------------------------------------

  @Get('levels')
  async levels(@Query() query: unknown) {
    const filters = z
      .object({
        world: z.coerce.number().int().min(1).max(1000).optional(),
        status: z.enum(levelStatuses).optional(),
        search: z.string().max(80).optional(),
        skip: z.coerce.number().int().min(0).default(0),
      })
      .parse(query);
    const page = pageSchema.parse(query);
    const where: Prisma.LevelWhereInput = {
      ...(filters.world ? { world: filters.world } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { slug: { contains: filters.search } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.level.findMany({
        where,
        orderBy: [{ world: 'asc' }, { index: 'asc' }],
        skip: filters.skip,
        take: page.limit,
        select: {
          id: true,
          slug: true,
          name: true,
          world: true,
          index: true,
          type: true,
          theme: true,
          status: true,
          difficulty: true,
          estimatedSeconds: true,
          publishedAt: true,
          updatedAt: true,
          author: { select: { id: true, username: true } },
        },
      }),
      this.db.level.count({ where }),
    ]);
    return { items, total, skip: filters.skip, limit: page.limit };
  }

  @Get('levels/:id')
  async level(@Param('id') id: string) {
    const level = await this.db.level.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: 'desc' }, take: 20 } },
    });
    if (!level) throw new NotFoundException('Level not found');
    return level;
  }

  @Post('levels')
  async createLevel(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const payload = levelPayloadSchema.parse(body);
    const definition = payload.definition;
    const clash = await this.db.level.findUnique({
      where: { world_index: { world: definition.world, index: definition.index } },
    });
    if (clash)
      throw new BadRequestException(
        `World ${definition.world} already has level ${definition.index}`,
      );

    const level = await this.db.level.create({
      data: {
        slug: `level-${definition.world}-${definition.index}-${Date.now().toString(36)}`,
        name: definition.name,
        description: payload.description,
        world: definition.world,
        index: definition.index,
        type: definition.type,
        theme: definition.theme,
        difficulty: payload.difficulty ?? 1,
        estimatedSeconds: payload.estimatedSeconds ?? 180,
        definition: definition as unknown as Prisma.InputJsonValue,
        authorId: request.user.sub,
        status: 'DRAFT',
        versions: {
          create: {
            version: 1,
            definition: definition as unknown as Prisma.InputJsonValue,
            createdBy: request.user.sub,
          },
        },
      },
    });
    await this.audit.fromRequest(request, 'LEVEL_CREATE', 'Level', level.id, null, {
      name: definition.name,
      world: definition.world,
      index: definition.index,
    });
    return level;
  }

  @Patch('levels/:id')
  async updateLevel(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const payload = levelPayloadSchema.parse(body);
    const definition = payload.definition;
    const current = await this.db.level.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!current) throw new NotFoundException('Level not found');

    const version = (current.versions[0]?.version ?? 0) + 1;
    const level = await this.db.$transaction(async (tx) => {
      await tx.levelVersion.create({
        data: {
          levelId: id,
          version,
          definition: definition as unknown as Prisma.InputJsonValue,
          createdBy: request.user.sub,
        },
      });
      return tx.level.update({
        where: { id },
        data: {
          name: definition.name,
          description: payload.description,
          world: definition.world,
          index: definition.index,
          type: definition.type,
          theme: definition.theme,
          ...(payload.difficulty !== undefined ? { difficulty: payload.difficulty } : {}),
          ...(payload.estimatedSeconds !== undefined
            ? { estimatedSeconds: payload.estimatedSeconds }
            : {}),
          definition: definition as unknown as Prisma.InputJsonValue,
        },
      });
    });
    await this.audit.fromRequest(
      request,
      'LEVEL_UPDATE',
      'Level',
      id,
      current.definition,
      definition,
    );
    return level;
  }

  /** Restores a previous version as the live definition (audited). */
  @Post('levels/:id/revert/:version')
  @Roles(UserRole.GAME_ADMIN, UserRole.SUPER_ADMIN)
  async revertLevel(
    @Param('id') id: string,
    @Param('version') version: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const target = await this.db.levelVersion.findUnique({
      where: { levelId_version: { levelId: id, version: Number(version) } },
    });
    if (!target) throw new NotFoundException('Version not found');
    const level = await this.db.level.update({
      where: { id },
      data: { definition: target.definition as Prisma.InputJsonValue },
    });
    await this.audit.fromRequest(request, 'LEVEL_REVERT', 'Level', id, null, { version });
    return level;
  }

  @Post('levels/:id/status')
  @Roles(UserRole.GAME_ADMIN, UserRole.SUPER_ADMIN)
  async setStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const data = z.object({ status: z.enum(levelStatuses) }).parse(body);
    const level = await this.db.level.update({
      where: { id },
      data: {
        status: data.status,
        publishedAt: data.status === 'PUBLISHED' ? new Date() : undefined,
      },
    });
    await this.audit.fromRequest(request, 'LEVEL_STATUS', 'Level', id, null, data);
    return level;
  }

  @Delete('levels/:id')
  @Roles(UserRole.GAME_ADMIN, UserRole.SUPER_ADMIN)
  async archiveLevel(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const level = await this.db.level.update({ where: { id }, data: { status: 'ARCHIVED' } });
    await this.audit.fromRequest(request, 'LEVEL_ARCHIVE', 'Level', id);
    return level;
  }

  /** Generates a campaign level definition without saving — editor scaffolding. */
  @Get('levels/generate/:index')
  generate(@Param('index') index: string) {
    const parsed = z.coerce.number().int().min(1).max(100_000).parse(index);
    return generateCampaignLevel(parsed);
  }

  @Get('worlds')
  async worlds() {
    const grouped = await this.db.level.groupBy({
      by: ['world', 'theme', 'status'],
      _count: { _all: true },
      orderBy: { world: 'asc' },
    });
    const worlds = new Map<
      number,
      { world: number; theme: string; published: number; total: number }
    >();
    for (const row of grouped) {
      const entry = worlds.get(row.world) ?? {
        world: row.world,
        theme: row.theme,
        published: 0,
        total: 0,
      };
      entry.total += row._count._all;
      if (row.status === 'PUBLISHED') entry.published += row._count._all;
      worlds.set(row.world, entry);
    }
    return { items: [...worlds.values()].sort((a, b) => a.world - b.world) };
  }

  // ----- tasks, achievements, catalog, seasons, announcements ------------------

  @Get('tasks')
  async tasks() {
    return { items: await this.db.taskDefinition.findMany({ orderBy: { key: 'asc' } }) };
  }

  @Post('tasks')
  async createTask(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const data = taskSchema.parse(body);
    const task = await this.db.taskDefinition.upsert({
      where: { key: data.key },
      update: {
        ...data,
        rewards: data.rewards as Prisma.InputJsonValue,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
      },
      create: {
        ...data,
        rewards: data.rewards as Prisma.InputJsonValue,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
      },
    });
    await this.audit.fromRequest(request, 'TASK_UPSERT', 'TaskDefinition', task.id, null, data);
    return task;
  }

  @Delete('tasks/:id')
  async deleteTask(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const task = await this.db.taskDefinition.update({ where: { id }, data: { active: false } });
    await this.audit.fromRequest(request, 'TASK_DISABLE', 'TaskDefinition', id);
    return task;
  }

  @Get('achievements')
  async achievements() {
    return { items: await this.db.achievement.findMany({ orderBy: { key: 'asc' } }) };
  }

  @Post('achievements')
  async createAchievement(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const data = achievementSchema.parse(body);
    const achievement = await this.db.achievement.upsert({
      where: { key: data.key },
      update: { ...data, rewards: data.rewards as Prisma.InputJsonValue },
      create: { ...data, rewards: data.rewards as Prisma.InputJsonValue },
    });
    await this.audit.fromRequest(
      request,
      'ACHIEVEMENT_UPSERT',
      'Achievement',
      achievement.id,
      null,
      data,
    );
    return achievement;
  }

  @Delete('achievements/:id')
  async deleteAchievement(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const achievement = await this.db.achievement.update({
      where: { id },
      data: { active: false },
    });
    await this.audit.fromRequest(request, 'ACHIEVEMENT_DISABLE', 'Achievement', id);
    return achievement;
  }

  @Get('catalog')
  async catalog() {
    return { items: await this.db.catalogItem.findMany({ orderBy: { sku: 'asc' } }) };
  }

  @Post('catalog')
  async upsertCatalog(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const data = catalogSchema.parse(body);
    const item = await this.db.catalogItem.upsert({
      where: { sku: data.sku },
      update: { ...data, metadata: data.metadata as Prisma.InputJsonValue },
      create: { ...data, metadata: data.metadata as Prisma.InputJsonValue },
    });
    await this.audit.fromRequest(request, 'CATALOG_UPSERT', 'CatalogItem', item.id, null, data);
    return item;
  }

  @Delete('catalog/:id')
  async disableCatalog(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const item = await this.db.catalogItem.update({ where: { id }, data: { active: false } });
    await this.audit.fromRequest(request, 'CATALOG_DISABLE', 'CatalogItem', id);
    return item;
  }

  @Get('seasons')
  async seasons() {
    return { items: await this.db.season.findMany({ orderBy: { number: 'desc' } }) };
  }

  @Post('seasons')
  @Roles(UserRole.GAME_ADMIN, UserRole.SUPER_ADMIN)
  async upsertSeason(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const data = seasonSchema.parse(body);
    if (new Date(data.endsAt) <= new Date(data.startsAt)) {
      throw new BadRequestException('Season end must be after its start');
    }
    const season = await this.db.season.upsert({
      where: { key: data.key },
      update: {
        ...data,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        rewards: data.rewards as Prisma.InputJsonValue,
      },
      create: {
        ...data,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        rewards: data.rewards as Prisma.InputJsonValue,
      },
    });
    if (data.active) {
      await this.db.season.updateMany({
        where: { id: { not: season.id } },
        data: { active: false },
      });
    }
    await this.audit.fromRequest(request, 'SEASON_UPSERT', 'Season', season.id, null, data);
    return season;
  }

  @Get('announcements')
  async announcements() {
    return {
      items: await this.db.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    };
  }

  @Post('announcements')
  async createAnnouncement(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const data = announcementSchema.parse(body);
    const announcement = await this.db.announcement.create({
      data: {
        title: data.title,
        body: data.body,
        audience: data.audience,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        createdBy: request.user.sub,
      },
    });
    await this.audit.fromRequest(
      request,
      'ANNOUNCEMENT_CREATE',
      'Announcement',
      announcement.id,
      null,
      data,
    );
    return announcement;
  }

  @Post('announcements/:id/publish')
  async publishAnnouncement(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const announcement = await this.db.announcement.update({
      where: { id },
      data: { publishedAt: new Date() },
    });
    await this.audit.fromRequest(request, 'ANNOUNCEMENT_PUBLISH', 'Announcement', id);
    return announcement;
  }

  @Delete('announcements/:id')
  async deleteAnnouncement(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    await this.db.announcement.delete({ where: { id } });
    await this.audit.fromRequest(request, 'ANNOUNCEMENT_DELETE', 'Announcement', id);
    return { deleted: true };
  }

  // ----- feature flags and remote config --------------------------------------

  @Get('flags')
  async listFlags() {
    return { items: await this.db.featureFlag.findMany({ orderBy: { key: 'asc' } }) };
  }

  @Post('flags')
  @Roles(UserRole.GAME_ADMIN, UserRole.SUPER_ADMIN)
  async upsertFlag(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const data = z
      .object({
        key: z.string().min(1).max(60),
        description: z.string().min(1).max(200),
        enabled: z.boolean(),
        config: z.record(z.unknown()).nullable().default(null),
      })
      .parse(body);
    const flag = await this.db.featureFlag.upsert({
      where: { key: data.key },
      update: {
        description: data.description,
        enabled: data.enabled,
        config: (data.config ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      create: {
        key: data.key,
        description: data.description,
        enabled: data.enabled,
        config: (data.config ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    await this.flags.invalidate();
    await this.audit.fromRequest(request, 'FLAG_UPSERT', 'FeatureFlag', flag.id, null, data);
    return flag;
  }
}
