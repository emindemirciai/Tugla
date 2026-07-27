import { createHash, createHmac, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GameMode } from '@tugla/database';
import { levelResultSchema, pageSchema } from '@tugla/shared';
import { z } from 'zod';
import {
  AccessGuard,
  type AuthenticatedRequest,
  DatabaseService,
  RedisService,
} from '../services/core';

const startSchema = z.object({
  levelId: z.string().uuid(),
  mode: z
    .enum(['CAMPAIGN', 'DAILY', 'LEAGUE', 'COMMUNITY', 'BOSS_RUSH', 'ENDLESS'])
    .default('CAMPAIGN'),
});

@Injectable()
export class GameService {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  private signSession(sessionId: string, nonce: string, seed: number) {
    return createHmac('sha256', process.env.SESSION_ENCRYPTION_KEY ?? 'development-game-secret')
      .update(`${sessionId}:${nonce}:${seed}`)
      .digest('hex');
  }

  async start(userId: string, input: unknown) {
    const data = startSchema.parse(input);
    const level = await this.database.level.findFirst({
      where: { id: data.levelId, status: 'PUBLISHED' },
    });
    if (!level) throw new NotFoundException('Level not found');
    const active = await this.database.gameSession.findFirst({
      where: { userId, status: { in: ['CREATED', 'ACTIVE', 'PAUSED'] } },
    });
    if (active) {
      await this.database.gameSession.update({
        where: { id: active.id },
        data: { status: 'ABANDONED', finishedAt: new Date() },
      });
    }
    const nonce = randomBytes(24).toString('base64url');
    const seed = Number.parseInt(randomBytes(4).toString('hex').slice(0, 7), 16);
    const session = await this.database.gameSession.create({
      data: {
        userId,
        levelId: level.id,
        mode: data.mode as GameMode,
        status: 'ACTIVE',
        seed,
        signedNonce: nonce,
      },
    });
    try {
      const redis = await this.redis.ensureConnected();
      await redis.set(`active-game:${userId}`, session.id, 'EX', 60 * 60);
    } catch {
      // PostgreSQL remains the source of truth when Redis is temporarily unavailable.
    }
    return {
      sessionId: session.id,
      seed,
      nonce,
      signature: this.signSession(session.id, nonce, seed),
      level: level.definition,
      serverTime: Date.now(),
    };
  }

  async complete(userId: string, input: unknown) {
    const result = levelResultSchema.parse(input);
    const session = await this.database.gameSession.findFirst({
      where: { id: result.sessionId, userId },
      include: { level: true },
    });
    if (!session || !['ACTIVE', 'PAUSED'].includes(session.status))
      throw new BadRequestException('Game session is not active');

    const expectedChecksum = createHash('sha256')
      .update(
        `${session.id}:${session.seed}:${result.score}:${result.durationMs}:${result.blocksDestroyed}:${result.eventCount}`,
      )
      .digest('hex');
    const scorePerBlock = result.score / Math.max(1, result.blocksDestroyed);
    const impossible =
      result.durationMs < 2_000 ||
      result.maxBalls > 500 ||
      scorePerBlock > 50_000 ||
      result.blocksDestroyed > 10_000;
    const checksumMismatch = result.checksum !== expectedChecksum;
    const riskScore = (impossible ? 80 : 0) + (checksumMismatch ? 25 : 0);
    const status = riskScore >= 80 ? 'FLAGGED' : result.livesRemaining > 0 ? 'COMPLETED' : 'FAILED';

    await this.database.$transaction(async (database) => {
      await database.gameSession.update({
        where: { id: session.id },
        data: {
          status,
          score: result.score,
          durationMs: result.durationMs,
          livesRemaining: result.livesRemaining,
          maxBalls: result.maxBalls,
          blocksDestroyed: result.blocksDestroyed,
          riskScore,
          finishedAt: new Date(),
        },
      });
      if (status === 'COMPLETED') {
        const progress = await database.userProgress.findUniqueOrThrow({ where: { userId } });
        await database.userProgress.update({
          where: { userId },
          data: {
            currentLevel: Math.max(progress.currentLevel, session.level.index + 1),
            experience: { increment: Math.max(10, Math.floor(result.score / 100)) },
            version: { increment: 1 },
            lastSyncedAt: new Date(),
          },
        });
        await database.walletBalance.update({
          where: { userId_currency: { userId, currency: 'CREDITS' } },
          data: {
            amount: { increment: Math.max(10, Math.floor(result.score / 50)) },
            version: { increment: 1 },
          },
        });
        const currentEntry = await database.leaderboardEntry.findUnique({
          where: {
            boardKey_userId: { boardKey: `level:${session.levelId}`, userId },
          },
        });
        await database.leaderboardEntry.upsert({
          where: {
            boardKey_userId: { boardKey: `level:${session.levelId}`, userId },
          },
          update: { score: Math.max(result.score, currentEntry?.score ?? 0) },
          create: {
            boardKey: `level:${session.levelId}`,
            userId,
            score: result.score,
          },
        });
      }
    });

    try {
      const redis = await this.redis.ensureConnected();
      await redis.del(`active-game:${userId}`);
    } catch {
      // Non-critical cache cleanup.
    }
    return { accepted: status !== 'FLAGGED', status, riskScore };
  }
}

@UseGuards(AccessGuard)
@Controller('game')
export class GameController {
  constructor(
    private readonly games: GameService,
    private readonly database: DatabaseService,
  ) {}

  @Get('levels')
  async levels(@Query() query: unknown) {
    const page = pageSchema.parse(query);
    const levels = await this.database.level.findMany({
      where: { status: 'PUBLISHED', ...(page.cursor ? { id: { gt: page.cursor } } : {}) },
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
    const level = await this.database.level.findFirst({
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
}
