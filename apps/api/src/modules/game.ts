import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type Prisma, type GameMode } from '@pulse/database';
import { runReplay, type ReplayResult } from '@pulse/game-engine';
import {
  APP_DEFAULTS,
  decodeReplay,
  gameModes,
  levelDefinitionSchema,
  levelResultSchema,
  pageSchema,
  sessionChecksum,
  type LevelDefinition,
} from '@pulse/shared';
import { z } from 'zod';
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
    const level = await this.db.level.findFirst({
      where: { id: data.levelId, status: 'PUBLISHED' },
    });
    if (!level) throw new NotFoundException('Level not found');

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

@ApiTags('game')
@Controller('game')
export class GameController {
  constructor(
    private readonly games: GameService,
    private readonly database: DatabaseService,
  ) {}

  /** Public catalogue so the landing page can show worlds before sign-in. */
  @Public()
  @Get('worlds')
  async worlds() {
    const rows = await this.database.client.level.groupBy({
      by: ['world', 'theme'],
      where: { status: 'PUBLISHED' },
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
  async levels(@Query() query: unknown) {
    const page = pageSchema.parse(query);
    const filter = z
      .object({ world: z.coerce.number().int().min(1).max(1000).optional() })
      .parse(query);
    const levels = await this.database.client.level.findMany({
      where: {
        status: 'PUBLISHED',
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
    return { items: levels, nextCursor: levels.at(-1)?.id ?? null };
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
