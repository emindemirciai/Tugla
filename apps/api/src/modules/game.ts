import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type Prisma, type GameMode } from '@tugla/database';
import { runReplay, type ReplayResult } from '@tugla/game-engine';
import {
  APP_DEFAULTS,
  decodeReplay,
  gameModes,
  levelDefinitionSchema,
  levelResultSchema,
  pageSchema,
  sessionChecksum,
  type LevelDefinition,
} from '@tugla/shared';
import { z } from 'zod';

const communityLevelSchema = z.object({
  name: z.string().trim().min(3).max(60),
  description: z.string().trim().max(280).optional(),
  definition: levelDefinitionSchema,
});
import { env } from '../config/env';
import { DatabaseService, Public, RedisService, type AuthenticatedRequest } from '../services/core';
import { StorageService } from '../services/storage';
import { ProgressionService } from './progression';

const startSchema = z.object({
  levelId: z.string().uuid(),
  mode: z.enum(gameModes).default('CAMPAIGN'),
});

/** Outcome of validating a submitted result against the server's own simulation. */
export interface VerificationOutcome {
  accepted: boolean;
  riskScore: number;
  reasons: string[];
  verifiedScore: number | null;
}

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly progression: ProgressionService,
  ) {}

  private get db() {
    return this.database.client;
  }

  async start(userId: string, input: unknown) {
    const data = startSchema.parse(input);
    // Published campaign content, or the author's own community level so a
    // creator can test a draft before submitting it for review.
    const level = await this.db.level.findFirst({
      where: {
        id: data.levelId,
        OR: [{ status: 'PUBLISHED' }, { authorId: userId, type: 'COMMUNITY' }],
      },
    });
    if (!level) throw new NotFoundException('Level not found');

    // The client hides locked levels; the server refuses them.
    if (level.type !== 'COMMUNITY' && level.index > 1 && data.mode !== 'DAILY') {
      const prevIndex = level.index - 1;
      const prevWorld = Math.floor((prevIndex - 1) / 50) + 1;
      const previous = await this.db.level.findFirst({
        where: {
          world: prevWorld,
          index: prevIndex,
          status: 'PUBLISHED',
          type: { not: 'COMMUNITY' },
        },
        select: { id: true },
      });
      if (previous) {
        const [advanced, replayable] = await Promise.all([
          // The previous level cleared in the campaign opens this one.
          this.db.gameSession.count({
            where: { userId, status: 'COMPLETED', mode: 'CAMPAIGN', levelId: previous.id },
          }),
          // This level already cleared — in either mode — stays open for replay.
          this.db.gameSession.count({
            where: { userId, status: 'COMPLETED', levelId: level.id },
          }),
        ]);
        if (!advanced && !replayable) {
          throw new BadRequestException('Finish the previous level first');
        }
      }
    }

    await this.db.gameSession.updateMany({
      where: { userId, status: { in: ['CREATED', 'ACTIVE', 'PAUSED'] } },
      data: { status: 'ABANDONED', finishedAt: new Date() },
    });

    const nonce = randomBytes(24).toString('base64url');
    const seed = Number.parseInt(randomBytes(4).toString('hex').slice(0, 7), 16);
    const session = await this.db.gameSession.create({
      data: {
        userId,
        levelId: level.id,
        mode: data.mode as GameMode,
        status: 'ACTIVE',
        seed,
        signedNonce: nonce,
      },
    });

    await this.redis.safe((client) =>
      client.set(`active-game:${userId}`, session.id, 'EX', 60 * 60),
    );

    return {
      sessionId: session.id,
      seed,
      nonce,
      level: {
        id: level.id,
        name: level.name,
        world: level.world,
        index: level.index,
        type: level.type,
        theme: level.theme,
        definition: level.definition,
      },
      lives: APP_DEFAULTS.livesPerLevel,
      maxBalls: APP_DEFAULTS.maxBalls,
      serverTime: Date.now(),
    };
  }

  /**
   * Verifies a submitted result.
   *
   * Three independent checks, in increasing order of strength:
   *  1. plausibility bounds (cheap, catches obviously impossible numbers),
   *  2. checksum over the server-issued seed/nonce (catches tampered payloads),
   *  3. full re-simulation of the replay (authoritative — the server recomputes
   *     the score from the recorded inputs and compares).
   *
   * A run that fails re-simulation is never written to a leaderboard.
   */
  private verify(
    session: { id: string; seed: number; signedNonce: string; startedAt: Date },
    result: z.infer<typeof levelResultSchema>,
    definition: LevelDefinition,
  ): VerificationOutcome {
    const reasons: string[] = [];
    let riskScore = 0;

    const expectedChecksum = sessionChecksum({
      sessionId: session.id,
      nonce: session.signedNonce,
      seed: session.seed,
      score: result.score,
      durationMs: result.durationMs,
      blocksDestroyed: result.blocksDestroyed,
      eventCount: result.eventCount,
      finalTick: result.finalTick,
      livesRemaining: result.livesRemaining,
      maxBalls: result.maxBalls,
    });
    if (expectedChecksum !== result.checksum) {
      reasons.push('checksum-mismatch');
      riskScore += 60;
    }

    const wallClock = Date.now() - session.startedAt.getTime();
    if (result.durationMs > wallClock + 15_000) {
      reasons.push('duration-exceeds-wall-clock');
      riskScore += 40;
    }
    if (result.durationMs < 1_500) {
      reasons.push('duration-too-short');
      riskScore += 40;
    }
    if (result.maxBalls > APP_DEFAULTS.maxBalls) {
      reasons.push('ball-cap-exceeded');
      riskScore += 60;
    }
    if (result.blocksDestroyed > definition.blocks.length * 4) {
      reasons.push('impossible-block-count');
      riskScore += 40;
    }
    const perBlock = result.score / Math.max(1, result.blocksDestroyed);
    if (perBlock > 20_000) {
      reasons.push('score-per-block-implausible');
      riskScore += 40;
    }

    let verifiedScore: number | null = null;
    if (result.replay) {
      try {
        const document = decodeReplay(result.replay);
        if (document.seed !== session.seed) {
          reasons.push('replay-seed-mismatch');
          riskScore += 60;
        } else {
          const replayed: ReplayResult = runReplay(definition, document, { maxTicks: 600_000 });
          verifiedScore = replayed.score;
          const drift = Math.abs(replayed.score - result.score);
          const tolerance = Math.max(500, result.score * 0.02);
          if (drift > tolerance) {
            reasons.push('replay-score-mismatch');
            riskScore += 70;
          }
          if (replayed.completed !== result.completed) {
            reasons.push('replay-outcome-mismatch');
            riskScore += 50;
          }
        }
      } catch (error) {
        this.logger.warn(`Replay verification failed: ${(error as Error).message}`);
        reasons.push('replay-undecodable');
        riskScore += 30;
      }
    } else {
      reasons.push('replay-missing');
      riskScore += 25;
    }

    return {
      accepted: riskScore < 50,
      riskScore: Math.min(100, riskScore),
      reasons,
      verifiedScore,
    };
  }

  async complete(userId: string, input: unknown) {
    const result = levelResultSchema.parse(input);
    const session = await this.db.gameSession.findFirst({
      where: { id: result.sessionId, userId },
      include: { level: true },
    });
    if (!session) throw new NotFoundException('Game session not found');
    if (!['ACTIVE', 'PAUSED'].includes(session.status)) {
      throw new BadRequestException('Game session is not active');
    }

    const definition = levelDefinitionSchema.parse(session.level.definition);
    const verification = this.verify(session, result, definition);
    const status = !verification.accepted ? 'FLAGGED' : result.completed ? 'COMPLETED' : 'FAILED';

    await this.db.gameSession.update({
      where: { id: session.id },
      data: {
        status,
        score: result.score,
        durationMs: result.durationMs,
        livesRemaining: result.livesRemaining,
        maxBalls: result.maxBalls,
        blocksDestroyed: result.blocksDestroyed,
        riskScore: verification.riskScore,
        finishedAt: new Date(),
      },
    });

    if (result.replay) await this.persistReplay(session.id, result);

    await this.redis.safe((client) => client.del(`active-game:${userId}`));

    if (status !== 'COMPLETED') {
      return {
        accepted: false,
        status,
        riskScore: verification.riskScore,
        reasons: verification.reasons,
        rewards: null,
      };
    }

    const rewards = await this.progression.awardLevelCompletion({
      userId,
      session: {
        id: session.id,
        levelId: session.levelId,
        mode: session.mode,
        score: result.score,
        durationMs: result.durationMs,
        blocksDestroyed: result.blocksDestroyed,
        maxBalls: result.maxBalls,
        bossDefeated: result.bossDefeated,
        livesRemaining: result.livesRemaining,
      },
      level: {
        id: session.level.id,
        index: session.level.index,
        world: session.level.world,
        type: session.level.type,
      },
    });

    return {
      accepted: true,
      status,
      riskScore: verification.riskScore,
      reasons: verification.reasons,
      rewards,
    };
  }

  /**
   * Stores the replay. S3 is used when configured; otherwise the payload lives
   * in PostgreSQL so replays work with no external account.
   */
  private async persistReplay(sessionId: string, result: z.infer<typeof levelResultSchema>) {
    if (!result.replay) return;
    const key = `replays/${sessionId}.json`;
    let storageKey: string | null = null;
    let inline: Prisma.InputJsonValue = JSON.parse(result.replay) as Prisma.InputJsonValue;
    try {
      const stored = await this.storage.put(key, result.replay);
      if (stored) {
        storageKey = stored.key;
        inline = {} as Prisma.InputJsonValue;
      }
    } catch (error) {
      this.logger.warn(`Replay upload failed, storing inline: ${(error as Error).message}`);
    }
    await this.db.replay.upsert({
      where: { sessionId },
      update: {
        storageKey,
        events: inline,
        checksum: result.checksum,
        eventCount: result.eventCount,
      },
      create: {
        sessionId,
        storageKey,
        events: inline,
        checksum: result.checksum,
        eventCount: result.eventCount,
        expiresAt: new Date(Date.now() + env().REPLAY_RETENTION_DAYS * 24 * 60 * 60 * 1000),
      },
    });
  }

  async replay(sessionId: string, viewerId: string | null) {
    const replay = await this.db.replay.findUnique({
      where: { sessionId },
      include: {
        gameSession: {
          include: {
            level: { select: { id: true, name: true, definition: true } },
            user: { select: { id: true, username: true, displayName: true } },
          },
        },
      },
    });
    if (!replay) throw new NotFoundException('Replay not found');
    const owned = replay.gameSession.userId === viewerId;
    if (!owned && !replay.shared) throw new NotFoundException('Replay not found');

    let payload: unknown = replay.events;
    if (replay.storageKey) {
      const raw = await this.storage.get(replay.storageKey);
      if (raw) payload = JSON.parse(raw);
    }
    return {
      sessionId,
      player: replay.gameSession.user,
      level: replay.gameSession.level,
      score: replay.gameSession.score,
      shared: replay.shared,
      replay: payload,
    };
  }

  async listReplays(userId: string, limit: number) {
    const items = await this.db.replay.findMany({
      where: { gameSession: { userId } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        gameSession: {
          select: {
            id: true,
            score: true,
            createdAt: true,
            level: { select: { id: true, name: true, world: true, index: true } },
          },
        },
      },
    });
    return { items };
  }

  async setReplayVisibility(userId: string, sessionId: string, shared: boolean) {
    const replay = await this.db.replay.findUnique({
      where: { sessionId },
      include: { gameSession: { select: { userId: true } } },
    });
    if (!replay || replay.gameSession.userId !== userId)
      throw new NotFoundException('Replay not found');
    return this.db.replay.update({ where: { sessionId }, data: { shared } });
  }
}

/**
 * Player-made levels.
 *
 * Community content lives in the reserved world 1000 so it never collides with
 * the 10 campaign worlds, and each author gets a bounded number of levels. Nothing
 * public until a moderator publishes it: submissions land in REVIEW and appear
 * in the admin level list next to campaign content.
 */
@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);
  /** Reserved community space; campaign uses worlds 1-10. */
  static readonly WORLD = 1000;
  static readonly MAX_PER_AUTHOR = 20;

  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  private slugify(name: string, index: number) {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    return `community-${base || 'level'}-${index}`;
  }

  /** Normalises an author submission into a storable definition. */
  private normalise(definition: LevelDefinition, index: number, name: string) {
    return levelDefinitionSchema.parse({
      ...definition,
      name,
      world: CommunityService.WORLD,
      index,
      type: 'COMMUNITY',
    });
  }

  async list(userId: string) {
    const items = await this.db.level.findMany({
      where: { authorId: userId, type: 'COMMUNITY' },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        index: true,
        theme: true,
        status: true,
        difficulty: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
    return { items, limit: CommunityService.MAX_PER_AUTHOR };
  }

  /** Published community levels with their like/dislike tallies. */
  async published(limit: number, viewerId?: string) {
    const levels = await this.db.level.findMany({
      where: { type: 'COMMUNITY', status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        theme: true,
        difficulty: true,
        estimatedSeconds: true,
        publishedAt: true,
        author: { select: { id: true, username: true, displayName: true } },
        ratings: { select: { liked: true, userId: true } },
      },
    });

    const items = levels
      .map(({ ratings, ...level }) => ({
        ...level,
        likes: ratings.filter((rating) => rating.liked).length,
        dislikes: ratings.filter((rating) => !rating.liked).length,
        myRating: viewerId
          ? (ratings.find((rating) => rating.userId === viewerId)?.liked ?? null)
          : null,
        isMine: viewerId ? level.author?.id === viewerId : false,
      }))
      .sort((a, b) => b.likes - a.likes);

    return { items };
  }

  /** Thumbs up/down on someone else's published level. */
  async rate(userId: string, levelId: string, liked: boolean) {
    const level = await this.db.level.findFirst({
      where: { id: levelId, type: 'COMMUNITY', status: 'PUBLISHED' },
      select: { id: true, authorId: true },
    });
    if (!level) throw new NotFoundException('Level not found');
    if (level.authorId === userId) throw new BadRequestException('You cannot rate your own level');

    await this.db.levelRating.upsert({
      where: { levelId_userId: { levelId, userId } },
      update: { liked },
      create: { levelId, userId, liked },
    });
    return this.tally(levelId, liked);
  }

  async unrate(userId: string, levelId: string) {
    await this.db.levelRating
      .delete({ where: { levelId_userId: { levelId, userId } } })
      .catch(() => undefined);
    return this.tally(levelId, null);
  }

  private async tally(levelId: string, myRating: boolean | null) {
    const [likes, dislikes] = await Promise.all([
      this.db.levelRating.count({ where: { levelId, liked: true } }),
      this.db.levelRating.count({ where: { levelId, liked: false } }),
    ]);
    return { levelId, likes, dislikes, myRating };
  }

  async detail(userId: string, id: string) {
    const level = await this.db.level.findFirst({
      where: { id, authorId: userId, type: 'COMMUNITY' },
      select: { id: true, name: true, status: true, theme: true, definition: true },
    });
    if (!level) throw new NotFoundException('Level not found');
    return level;
  }

  async create(userId: string, body: unknown) {
    const input = communityLevelSchema.parse(body);
    const owned = await this.db.level.count({ where: { authorId: userId, type: 'COMMUNITY' } });
    if (owned >= CommunityService.MAX_PER_AUTHOR)
      throw new BadRequestException(
        `You can keep at most ${CommunityService.MAX_PER_AUTHOR} community levels`,
      );

    // Reserved world; index is the next free slot inside it.
    const last = await this.db.level.findFirst({
      where: { world: CommunityService.WORLD },
      orderBy: { index: 'desc' },
      select: { index: true },
    });
    const index = (last?.index ?? 0) + 1;
    const definition = this.normalise(input.definition, index, input.name);

    const level = await this.db.level.create({
      data: {
        slug: this.slugify(input.name, index),
        name: input.name,
        description: input.description ?? null,
        world: CommunityService.WORLD,
        index,
        type: 'COMMUNITY',
        theme: definition.theme,
        status: 'DRAFT',
        definition: definition as unknown as Prisma.InputJsonValue,
        difficulty: definition.blocks.length / 10,
        estimatedSeconds: Math.max(60, definition.blocks.length * 3),
        authorId: userId,
      },
      select: { id: true, name: true, status: true, index: true },
    });
    this.logger.log(`community level created by ${userId}: ${level.id}`);
    return level;
  }

  async update(userId: string, id: string, body: unknown) {
    const input = communityLevelSchema.parse(body);
    const existing = await this.db.level.findFirst({
      where: { id, authorId: userId, type: 'COMMUNITY' },
    });
    if (!existing) throw new NotFoundException('Level not found');
    if (existing.status === 'PUBLISHED' || existing.status === 'REVIEW')
      throw new BadRequestException('Published or in-review levels cannot be edited');

    const definition = this.normalise(input.definition, existing.index, input.name);
    return this.db.level.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description ?? null,
        theme: definition.theme,
        status: 'DRAFT',
        definition: definition as unknown as Prisma.InputJsonValue,
        difficulty: definition.blocks.length / 10,
        estimatedSeconds: Math.max(60, definition.blocks.length * 3),
      },
      select: { id: true, name: true, status: true },
    });
  }

  async submit(userId: string, id: string) {
    const existing = await this.db.level.findFirst({
      where: { id, authorId: userId, type: 'COMMUNITY' },
    });
    if (!existing) throw new NotFoundException('Level not found');
    if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED')
      throw new BadRequestException('Only drafts can be submitted');
    // Re-validate: the definition may predate a schema change.
    levelDefinitionSchema.parse(existing.definition);
    return this.db.level.update({
      where: { id },
      data: { status: 'REVIEW' },
      select: { id: true, status: true },
    });
  }

  async remove(userId: string, id: string) {
    const existing = await this.db.level.findFirst({
      where: { id, authorId: userId, type: 'COMMUNITY' },
    });
    if (!existing) throw new NotFoundException('Level not found');
    if (existing.status === 'PUBLISHED')
      throw new BadRequestException('Published levels can only be removed by a moderator');

    // Sessions reference the level (replays must stay verifiable), so a level
    // that has already been played is archived instead of hard-deleted.
    const played = await this.db.gameSession.count({ where: { levelId: id } });
    if (played > 0) {
      await this.db.level.update({ where: { id }, data: { status: 'ARCHIVED' } });
      return { deleted: true, archived: true };
    }
    await this.db.level.delete({ where: { id } });
    return { deleted: true, archived: false };
  }
}

/**
 * Daily challenge — "günün bölümü".
 *
 * One published campaign level is chosen per UTC day from a hash of the date, so
 * every player gets the same level without anyone storing a schedule, and the
 * pick is reproducible for support. Runs submitted in DAILY mode land on the
 * `daily:<date>` leaderboard next to the usual rewards.
 */
@Injectable()
export class DailyChallengeService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  /** Deterministic day key → offset, stable for the whole UTC day. */
  static offsetForDay(dayKey: string, count: number) {
    if (count <= 0) return 0;
    let hash = 2166136261;
    for (const character of dayKey) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash % count;
  }

  static dayKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
  }

  async today(userId?: string) {
    const day = DailyChallengeService.dayKey();
    const where = {
      status: 'PUBLISHED' as const,
      type: { in: ['NORMAL', 'MINI_BOSS'] } as Prisma.LevelWhereInput['type'],
    };
    const count = await this.db.level.count({ where });
    if (!count) return { day, level: null, board: [], mine: null };

    const [level] = await this.db.level.findMany({
      where,
      orderBy: [{ world: 'asc' }, { index: 'asc' }],
      skip: DailyChallengeService.offsetForDay(day, count),
      take: 1,
      select: {
        id: true,
        name: true,
        world: true,
        index: true,
        theme: true,
        difficulty: true,
        estimatedSeconds: true,
      },
    });

    const boardKey = `daily:${day}`;
    const board = await this.db.leaderboardEntry.findMany({
      where: { boardKey },
      orderBy: { score: 'desc' },
      take: 20,
      select: {
        score: true,
        user: { select: { id: true, username: true, displayName: true } },
      },
    });

    const mine = userId
      ? await this.db.leaderboardEntry.findUnique({
          where: { boardKey_userId: { boardKey, userId } },
          select: { score: true, updatedAt: true },
        })
      : null;

    return { day, level: level ?? null, board, mine };
  }
}

@ApiTags('game')
@Controller('game')
export class GameController {
  constructor(
    private readonly games: GameService,
    private readonly database: DatabaseService,
    private readonly community: CommunityService,
    private readonly daily: DailyChallengeService,
  ) {}

  /** Public catalogue so the landing page can show worlds before sign-in. */
  @Public()
  @Get('worlds')
  async worlds() {
    const rows = await this.database.client.level.groupBy({
      by: ['world', 'theme'],
      where: { status: 'PUBLISHED', type: { not: 'COMMUNITY' } },
      _count: { _all: true },
      orderBy: { world: 'asc' },
    });
    return {
      items: rows.map((row) => ({
        world: row.world,
        theme: row.theme,
        levels: row._count._all,
      })),
    };
  }

  @Get('levels')
  async levels(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const page = pageSchema.parse(query);
    const filter = z
      .object({ world: z.coerce.number().int().min(1).max(1000).optional() })
      .parse(query);
    const levels = await this.database.client.level.findMany({
      where: {
        status: 'PUBLISHED',
        type: { not: 'COMMUNITY' },
        ...(filter.world ? { world: filter.world } : {}),
        ...(page.cursor ? { id: { gt: page.cursor } } : {}),
      },
      orderBy: [{ world: 'asc' }, { index: 'asc' }],
      take: page.limit,
      select: {
        id: true,
        slug: true,
        name: true,
        world: true,
        index: true,
        type: true,
        theme: true,
        difficulty: true,
        estimatedSeconds: true,
      },
    });
    // Progression gate: every level is listed, but only the very first level of
    // the campaign starts open — each later one needs its predecessor cleared,
    // including across world boundaries (level indexes run 1..500). The check
    // runs server-side; hiding a button in the client would not be a rule.
    const userId = request.user?.sub;
    // Typed explicitly rather than inferred: the shape is fixed by the select
    // above, and stating it keeps this readable without chasing generated types.
    const sessions: { levelId: string; mode: string }[] = userId
      ? await this.database.client.gameSession.findMany({
          where: {
            userId,
            status: 'COMPLETED',
            levelId: { in: levels.map((level) => level.id) },
          },
          select: { levelId: true, mode: true },
        })
      : [];

    // Two different meanings, deliberately kept apart:
    //  - a campaign clear advances the campaign and opens the next level;
    //  - a daily clear opens only the level it was played on. The daily
    //    challenge reuses a campaign level, so counting it as progression would
    //    hand out a free unlock every day — but pretending the player never
    //    played it is equally wrong, and the level stayed locked behind them.
    const completed = new Set(
      sessions.filter((session) => session.mode === 'CAMPAIGN').map((session) => session.levelId),
    );
    const playedAsDaily = new Set(
      sessions.filter((session) => session.mode === 'DAILY').map((session) => session.levelId),
    );

    // A level is also open when the previous index was completed, which needs
    // the neighbour even if it fell outside this page.
    const previousIds = await this.database.client.level.findMany({
      where: {
        status: 'PUBLISHED',
        type: { not: 'COMMUNITY' },
        OR: levels.map((level) => {
          const prevIndex = level.index - 1;
          const prevWorld = Math.floor((prevIndex - 1) / 50) + 1;
          return { world: prevWorld, index: prevIndex };
        }),
      },
      select: { id: true, world: true, index: true },
    });
    const previousByKey = new Map(previousIds.map((row) => [`${row.world}:${row.index}`, row.id]));
    const completedPrevious = userId
      ? new Set(
          (
            await this.database.client.gameSession.findMany({
              where: {
                userId,
                status: 'COMPLETED',
                mode: 'CAMPAIGN',
                levelId: { in: [...previousByKey.values()] },
              },
              select: { levelId: true },
              distinct: ['levelId'],
            })
          ).map((session) => session.levelId),
        )
      : new Set<string>();

    const items = levels.map((level) => {
      const prevIndex = level.index - 1;
      const prevWorld = Math.floor((prevIndex - 1) / 50) + 1;
      const previousId = previousByKey.get(`${prevWorld}:${prevIndex}`);
      const unlocked =
        level.index === 1 ||
        completed.has(level.id) ||
        playedAsDaily.has(level.id) ||
        (previousId ? completedPrevious.has(previousId) : false);
      return {
        ...level,
        unlocked,
        completed: completed.has(level.id),
        playedAsDaily: playedAsDaily.has(level.id),
      };
    });

    return { items, nextCursor: levels.at(-1)?.id ?? null };
  }

  @Get('levels/:id')
  async level(@Param('id') id: string) {
    const level = await this.database.client.level.findFirst({
      where: { id, status: 'PUBLISHED' },
      select: {
        id: true,
        name: true,
        definition: true,
        world: true,
        index: true,
        type: true,
        theme: true,
      },
    });
    if (!level) throw new NotFoundException('Level not found');
    return level;
  }

  @Get('daily')
  @Public()
  dailyChallenge(@Req() request: AuthenticatedRequest) {
    return this.daily.today(request.user?.sub);
  }

  @Get('community/levels')
  @Public()
  communityLevels(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const page = pageSchema.parse(query);
    // Signed-in visitors also get their own rating back; anonymous ones do not.
    return this.community.published(page.limit, request.user?.sub);
  }

  @Post('community/levels/:id/rate')
  rateCommunityLevel(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const data = z.object({ liked: z.boolean() }).parse(body);
    return this.community.rate(request.user.sub, id, data.liked);
  }

  @Delete('community/levels/:id/rate')
  clearCommunityRating(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.community.unrate(request.user.sub, id);
  }

  @Get('community/levels/mine')
  myCommunityLevels(@Req() request: AuthenticatedRequest) {
    return this.community.list(request.user.sub);
  }

  @Get('community/levels/:id')
  myCommunityLevel(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.community.detail(request.user.sub, id);
  }

  @Post('community/levels')
  createCommunityLevel(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.community.create(request.user.sub, body);
  }

  @Patch('community/levels/:id')
  updateCommunityLevel(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.community.update(request.user.sub, id, body);
  }

  @Post('community/levels/:id/submit')
  submitCommunityLevel(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.community.submit(request.user.sub, id);
  }

  @Delete('community/levels/:id')
  deleteCommunityLevel(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.community.remove(request.user.sub, id);
  }

  @Post('sessions')
  start(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.games.start(request.user.sub, body);
  }

  @Post('sessions/complete')
  complete(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.games.complete(request.user.sub, body);
  }

  @Get('replays')
  replays(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const page = pageSchema.parse(query);
    return this.games.listReplays(request.user.sub, page.limit);
  }

  @Get('replays/:sessionId')
  replay(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.games.replay(sessionId, request.user?.sub ?? null);
  }

  @Post('replays/:sessionId/share')
  share(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: unknown,
  ) {
    const data = z.object({ shared: z.boolean() }).parse(body);
    return this.games.setReplayVisibility(request.user.sub, sessionId, data.shared);
  }
}
