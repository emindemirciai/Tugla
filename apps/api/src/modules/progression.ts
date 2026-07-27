import { Body, Controller, Get, Injectable, Logger, Param, Post, Query, Req } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiTags } from '@nestjs/swagger';
import { Currency, Prisma, TaskCadence, type GameMode } from '@tugla/database';
import { pageSchema } from '@tugla/shared';
import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';
import { DatabaseService, Public, RedisService, type AuthenticatedRequest } from '../services/core';

export interface RewardBreakdown {
  credits: number;
  crystals: number;
  experience: number;
  playerLevel: number;
  unlockedLevel: number;
  tasksCompleted: string[];
  achievementsUnlocked: string[];
  leagueScore: number | null;
  personalBest: boolean;
}

/** ISO week key, used to bucket weekly tasks and league seasons. */
export const weekKey = (date = new Date()) => {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

export const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);

export const periodKeyFor = (cadence: TaskCadence, date = new Date()) => {
  if (cadence === 'DAILY') return dayKey(date);
  if (cadence === 'WEEKLY') return weekKey(date);
  if (cadence === 'SEASONAL')
    return `S${date.getUTCFullYear()}-${Math.floor(date.getUTCMonth() / 3) + 1}`;
  return 'PERMANENT';
};

/** Experience required to reach the next player level; grows quadratically. */
export const experienceForLevel = (level: number) => 500 + (level - 1) * 350;

@Injectable()
export class ProgressionService {
  private readonly logger = new Logger(ProgressionService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  private get db() {
    return this.database.client;
  }

  /**
   * Credits or debits a wallet inside a transaction and writes a ledger row.
   * Every currency movement in the system goes through here so the economy
   * screen in the admin panel reflects reality rather than a guess.
   */
  async adjustWallet(
    tx: Prisma.TransactionClient,
    userId: string,
    currency: Currency,
    amount: number,
    reason: string,
    reference?: string,
  ) {
    if (amount === 0) return null;
    const balance = await tx.walletBalance.upsert({
      where: { userId_currency: { userId, currency } },
      update: { amount: { increment: amount }, version: { increment: 1 } },
      create: { userId, currency, amount: Math.max(0, amount) },
    });
    if (balance.amount < 0) throw new BadRequestException('Insufficient balance');
    await tx.walletTransaction.create({
      data: { userId, currency, amount, balance: balance.amount, reason, reference },
    });
    return balance;
  }

  /** Applies every progression side-effect of a verified level completion. */
  async awardLevelCompletion(input: {
    userId: string;
    session: {
      id: string;
      levelId: string;
      mode: GameMode;
      score: number;
      durationMs: number;
      blocksDestroyed: number;
      maxBalls: number;
      bossDefeated: boolean;
      livesRemaining: number;
    };
    level: { id: string; index: number; world: number; type: string };
  }): Promise<RewardBreakdown> {
    const { userId, session, level } = input;
    const credits = Math.max(10, Math.floor(session.score / 50));
    const crystals = level.type === 'WORLD_BOSS' ? 25 : level.type === 'MINI_BOSS' ? 8 : 0;
    const experience = Math.max(10, Math.floor(session.score / 100)) + session.livesRemaining * 5;

    const result = await this.db.$transaction(async (tx) => {
      const progress = await tx.userProgress.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });

      let playerLevel = progress.playerLevel;
      let pool = progress.experience + experience;
      while (pool >= experienceForLevel(playerLevel)) {
        pool -= experienceForLevel(playerLevel);
        playerLevel += 1;
      }

      const unlockedLevel = Math.max(progress.currentLevel, level.index + 1);
      await tx.userProgress.update({
        where: { userId },
        data: {
          currentLevel: unlockedLevel,
          playerLevel,
          experience: pool,
          version: { increment: 1 },
          lastSyncedAt: new Date(),
        },
      });

      await this.adjustWallet(tx, userId, 'CREDITS', credits, 'LEVEL_COMPLETE', session.id);
      if (crystals)
        await this.adjustWallet(tx, userId, 'CRYSTALS', crystals, 'BOSS_REWARD', session.id);

      const boardKey = `level:${level.id}`;
      const existing = await tx.leaderboardEntry.findUnique({
        where: { boardKey_userId: { boardKey, userId } },
      });
      const personalBest = !existing || session.score > existing.score;
      if (personalBest) {
        await tx.leaderboardEntry.upsert({
          where: { boardKey_userId: { boardKey, userId } },
          update: { score: session.score, metadata: { durationMs: session.durationMs } },
          create: {
            boardKey,
            userId,
            score: session.score,
            metadata: { durationMs: session.durationMs },
          },
        });
      }

      const globalKey = `global:${weekKey()}`;
      const globalEntry = await tx.leaderboardEntry.findUnique({
        where: { boardKey_userId: { boardKey: globalKey, userId } },
      });
      await tx.leaderboardEntry.upsert({
        where: { boardKey_userId: { boardKey: globalKey, userId } },
        update: { score: { increment: session.score } },
        create: { boardKey: globalKey, userId, score: session.score },
      });
      void globalEntry;

      return { playerLevel, unlockedLevel, personalBest };
    });

    const events: { type: string; amount: number }[] = [
      { type: 'LEVEL_COMPLETED', amount: 1 },
      { type: 'BLOCK_DESTROYED', amount: session.blocksDestroyed },
      { type: 'SCORE_EARNED', amount: session.score },
      { type: 'MAX_BALLS', amount: session.maxBalls },
    ];
    if (session.bossDefeated) events.push({ type: 'BOSS_DEFEATED', amount: 1 });

    const tasksCompleted = await this.recordTaskEvents(userId, events);
    const achievementsUnlocked = await this.recordAchievementEvents(userId, events);
    const leagueScore = await this.recordLeagueScore(userId, session.score);

    return {
      credits,
      crystals,
      experience,
      playerLevel: result.playerLevel,
      unlockedLevel: result.unlockedLevel,
      tasksCompleted,
      achievementsUnlocked,
      leagueScore,
      personalBest: result.personalBest,
    };
  }

  /** Advances every active task matching the supplied gameplay events. */
  async recordTaskEvents(userId: string, events: { type: string; amount: number }[]) {
    const now = new Date();
    const tasks = await this.db.taskDefinition.findMany({
      where: {
        active: true,
        eventType: { in: events.map((event) => event.type) },
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
    });
    const completed: string[] = [];
    for (const task of tasks) {
      const amount = events.find((event) => event.type === task.eventType)?.amount ?? 0;
      if (amount <= 0) continue;
      const periodKey = periodKeyFor(task.cadence, now);
      const current = await this.db.userTaskProgress.upsert({
        where: { userId_taskId_periodKey: { userId, taskId: task.id, periodKey } },
        update: { progress: { increment: amount } },
        create: { userId, taskId: task.id, periodKey, progress: amount },
      });
      if (current.progress >= task.target && !current.completedAt) {
        await this.db.userTaskProgress.update({
          where: { id: current.id },
          data: { completedAt: new Date() },
        });
        completed.push(task.key);
      }
    }
    return completed;
  }

  async recordAchievementEvents(userId: string, events: { type: string; amount: number }[]) {
    const achievements = await this.db.achievement.findMany({
      where: { active: true, eventType: { in: events.map((event) => event.type) } },
    });
    const unlocked: string[] = [];
    for (const achievement of achievements) {
      const amount = events.find((event) => event.type === achievement.eventType)?.amount ?? 0;
      if (amount <= 0) continue;
      const existing = await this.db.achievementUnlock.findUnique({
        where: { userId_achievementId: { userId, achievementId: achievement.id } },
      });
      // Peak-style achievements track their best value; counters accumulate.
      const isPeak = achievement.eventType === 'MAX_BALLS';
      const progress = isPeak
        ? Math.max(existing?.progress ?? 0, amount)
        : (existing?.progress ?? 0) + amount;
      const record = await this.db.achievementUnlock.upsert({
        where: { userId_achievementId: { userId, achievementId: achievement.id } },
        update: { progress },
        create: { userId, achievementId: achievement.id, progress },
      });
      if (progress >= achievement.target && !record.unlockedAt) {
        await this.db.achievementUnlock.update({
          where: { id: record.id },
          data: { unlockedAt: new Date() },
        });
        unlocked.push(achievement.key);
      }
    }
    return unlocked;
  }

  /** Adds score to the player's current weekly league group, if they are in one. */
  async recordLeagueScore(userId: string, score: number) {
    const membership = await this.db.leagueMembership.findFirst({
      where: { user: { id: userId }, group: { league: { endsAt: { gt: new Date() } } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!membership) {
      const joined = await this.joinCurrentLeague(userId);
      if (!joined) return null;
      const updated = await this.db.leagueMembership.update({
        where: { id: joined.id },
        data: { score: { increment: score } },
      });
      return updated.score;
    }
    const updated = await this.db.leagueMembership.update({
      where: { id: membership.id },
      data: { score: { increment: score } },
    });
    return updated.score;
  }

  /**
   * Places a player into the current week's league, creating groups of up to
   * 30 so competition stays meaningful as the population grows.
   */
  async joinCurrentLeague(userId: string) {
    const key = weekKey();
    const league = await this.db.league.findUnique({ where: { key }, include: { groups: true } });
    const active = league ?? (await this.ensureLeague(key));
    const groups = await this.db.leagueGroup.findMany({
      where: { leagueId: active.id },
      include: { _count: { select: { members: true } } },
      orderBy: { groupNumber: 'asc' },
    });
    let target = groups.find((group) => group._count.members < 30);
    if (!target) {
      const created = await this.db.leagueGroup.create({
        data: { leagueId: active.id, groupNumber: groups.length + 1 },
        include: { _count: { select: { members: true } } },
      });
      target = created;
    }
    return this.db.leagueMembership.upsert({
      where: { groupId_userId: { groupId: target.id, userId } },
      update: {},
      create: { groupId: target.id, userId },
    });
  }

  private async ensureLeague(key: string) {
    const now = new Date();
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() || 7) - 1));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return this.db.league.upsert({
      where: { key },
      update: {},
      create: {
        key,
        tier: 'OPEN',
        startsAt: start,
        endsAt: end,
        seed: Math.floor(Math.random() * 2 ** 31),
        rules: { groupSize: 30, promote: 5, demote: 5 },
      },
    });
  }

  async claimTask(userId: string, taskId: string) {
    const task = await this.db.taskDefinition.findUniqueOrThrow({ where: { id: taskId } });
    const periodKey = periodKeyFor(task.cadence);
    const progress = await this.db.userTaskProgress.findUnique({
      where: { userId_taskId_periodKey: { userId, taskId, periodKey } },
    });
    if (!progress?.completedAt) throw new BadRequestException('Task is not complete yet');
    if (progress.claimedAt) throw new BadRequestException('Reward already claimed');
    const rewards = (task.rewards ?? {}) as { credits?: number; crystals?: number };
    await this.db.$transaction(async (tx) => {
      await tx.userTaskProgress.update({
        where: { id: progress.id },
        data: { claimedAt: new Date() },
      });
      if (rewards.credits) {
        await this.adjustWallet(tx, userId, 'CREDITS', rewards.credits, 'TASK_REWARD', task.key);
      }
      if (rewards.crystals) {
        await this.adjustWallet(tx, userId, 'CRYSTALS', rewards.crystals, 'TASK_REWARD', task.key);
      }
    });
    return { claimed: true, rewards };
  }

  async claimAchievement(userId: string, achievementId: string) {
    const achievement = await this.db.achievement.findUniqueOrThrow({
      where: { id: achievementId },
    });
    const unlock = await this.db.achievementUnlock.findUnique({
      where: { userId_achievementId: { userId, achievementId } },
    });
    if (!unlock?.unlockedAt) throw new BadRequestException('Achievement is not unlocked yet');
    if (unlock.claimedAt) throw new BadRequestException('Reward already claimed');
    const rewards = (achievement.rewards ?? {}) as { credits?: number; crystals?: number };
    await this.db.$transaction(async (tx) => {
      await tx.achievementUnlock.update({
        where: { id: unlock.id },
        data: { claimedAt: new Date() },
      });
      if (rewards.credits) {
        await this.adjustWallet(
          tx,
          userId,
          'CREDITS',
          rewards.credits,
          'ACHIEVEMENT_REWARD',
          achievement.key,
        );
      }
      if (rewards.crystals) {
        await this.adjustWallet(
          tx,
          userId,
          'CRYSTALS',
          rewards.crystals,
          'ACHIEVEMENT_REWARD',
          achievement.key,
        );
      }
    });
    return { claimed: true, rewards };
  }

  /**
   * Weekly league settlement: ranks each group, marks promotion/demotion and
   * pays out. Runs every Monday 00:05 UTC and is idempotent per league.
   */
  @Cron('5 0 * * 1')
  async settleLeagues() {
    const finished = await this.db.league.findMany({
      where: { endsAt: { lte: new Date() } },
      include: { groups: { include: { members: true } } },
      take: 20,
    });
    for (const league of finished) {
      for (const group of league.groups) {
        const ranked = [...group.members].sort((a, b) => b.score - a.score);
        const alreadySettled = ranked.every((member) => member.rank !== null);
        if (alreadySettled) continue;
        for (const [index, member] of ranked.entries()) {
          const rank = index + 1;
          const promoted = rank <= 5 ? true : rank > ranked.length - 5 ? false : null;
          await this.db.leagueMembership.update({
            where: { id: member.id },
            data: { rank, promoted },
          });
          const reward = rank === 1 ? 500 : rank <= 3 ? 300 : rank <= 10 ? 150 : 50;
          await this.db.$transaction(async (tx) => {
            await this.adjustWallet(
              tx,
              member.userId,
              'CREDITS',
              reward,
              'LEAGUE_REWARD',
              league.key,
            );
          });
          await this.db.notification.create({
            data: {
              userId: member.userId,
              type: 'LEAGUE_RESULT',
              title: 'Weekly league finished',
              body: `You placed #${rank} and earned ${reward} credits.`,
              data: { leagueKey: league.key, rank, reward },
            },
          });
        }
      }
    }
    this.logger.log(`Settled ${finished.length} league(s)`);
  }

  /** Expires replays past their retention window. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async pruneExpiredReplays() {
    const deleted = await this.db.replay.deleteMany({
      where: { expiresAt: { lt: new Date() }, favorite: false },
    });
    if (deleted.count) this.logger.log(`Pruned ${deleted.count} expired replays`);
  }

  /** Removes refresh sessions that can no longer be used. */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async pruneSessions() {
    await this.db.refreshSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await this.db.actionToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }
}

@ApiTags('progression')
@Controller('progression')
export class ProgressionController {
  constructor(
    private readonly progression: ProgressionService,
    private readonly database: DatabaseService,
  ) {}

  private get db() {
    return this.database.client;
  }

  @Get('tasks')
  async tasks(@Req() request: AuthenticatedRequest) {
    const now = new Date();
    const tasks = await this.db.taskDefinition.findMany({
      where: {
        active: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: [{ cadence: 'asc' }, { key: 'asc' }],
    });
    const progress = await this.db.userTaskProgress.findMany({
      where: { userId: request.user.sub, taskId: { in: tasks.map((task) => task.id) } },
    });
    return {
      items: tasks.map((task) => {
        const periodKey = periodKeyFor(task.cadence, now);
        const current = progress.find(
          (entry) => entry.taskId === task.id && entry.periodKey === periodKey,
        );
        return {
          id: task.id,
          key: task.key,
          name: task.name,
          description: task.description,
          cadence: task.cadence,
          target: task.target,
          rewards: task.rewards,
          progress: current?.progress ?? 0,
          completed: Boolean(current?.completedAt),
          claimed: Boolean(current?.claimedAt),
          periodKey,
        };
      }),
    };
  }

  @Post('tasks/:id/claim')
  claimTask(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.progression.claimTask(request.user.sub, id);
  }

  @Get('achievements')
  async achievements(@Req() request: AuthenticatedRequest) {
    const achievements = await this.db.achievement.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
    const unlocks = await this.db.achievementUnlock.findMany({
      where: { userId: request.user.sub },
    });
    return {
      items: achievements
        .map((achievement) => {
          const unlock = unlocks.find((entry) => entry.achievementId === achievement.id);
          return {
            id: achievement.id,
            key: achievement.key,
            name: achievement.name,
            description: achievement.description,
            category: achievement.category,
            target: achievement.target,
            rewards: achievement.rewards,
            hidden: achievement.hidden,
            progress: unlock?.progress ?? 0,
            unlocked: Boolean(unlock?.unlockedAt),
            claimed: Boolean(unlock?.claimedAt),
          };
        })
        .filter((item) => !item.hidden || item.unlocked),
    };
  }

  @Post('achievements/:id/claim')
  claimAchievement(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.progression.claimAchievement(request.user.sub, id);
  }

  @Get('league')
  async league(@Req() request: AuthenticatedRequest) {
    const membership = await this.progression.joinCurrentLeague(request.user.sub);
    const group = await this.db.leagueGroup.findUniqueOrThrow({
      where: { id: membership.groupId },
      include: {
        league: true,
        members: {
          orderBy: { score: 'desc' },
          include: { user: { select: { id: true, username: true, displayName: true } } },
        },
      },
    });
    return {
      league: { key: group.league.key, tier: group.league.tier, endsAt: group.league.endsAt },
      groupNumber: group.groupNumber,
      standings: group.members.map((member, index) => ({
        rank: index + 1,
        userId: member.userId,
        username: member.user.username,
        displayName: member.user.displayName,
        score: member.score,
        isSelf: member.userId === request.user.sub,
      })),
    };
  }

  @Public()
  @Get('seasons/current')
  async currentSeason() {
    const season = await this.db.season.findFirst({
      where: { active: true, startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
      orderBy: { startsAt: 'desc' },
    });
    return { season };
  }

  @Get('wallet')
  async wallet(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const page = pageSchema.parse(query);
    const [balances, transactions] = await Promise.all([
      this.db.walletBalance.findMany({ where: { userId: request.user.sub } }),
      this.db.walletTransaction.findMany({
        where: { userId: request.user.sub },
        orderBy: { createdAt: 'desc' },
        take: page.limit,
      }),
    ]);
    return { balances, transactions };
  }
}
