import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';

for (const path of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  if (existsSync(path)) {
    loadDotenv({ path, override: false });
    break;
  }
}
import { PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { worldThemes } from '@tugla/shared';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ?? 'postgresql://tugla:tugla@localhost:5432/tugla?schema=public',
  }),
});

const makeBlocks = (level: number) =>
  Array.from({ length: Math.min(28 + Math.floor(level / 8), 72) }, (_, index) => {
    const columns = 8;
    const row = Math.floor(index / columns);
    const column = index % columns;
    const kind =
      level % 50 === 0 && index === 0
        ? 'BOSS_CORE'
        : index % 17 === 0
          ? 'EXPLOSIVE'
          : index % 13 === 0
            ? 'ARMORED'
            : index % 11 === 0
              ? 'TOUGH'
              : 'NORMAL';
    return {
      id: `l${level}-b${index + 1}`,
      kind,
      x: 0.08 + column * 0.12,
      y: 0.84 - row * 0.055,
      width: 0.102,
      height: 0.038,
      hitPoints:
        kind === 'BOSS_CORE' ? 50 + level : kind === 'ARMORED' ? 4 : kind === 'TOUGH' ? 2 : 1,
      rotation: 0,
      bonus: index % 19 === 0 ? 'BALL_3' : index % 31 === 0 ? 'BALL_DOUBLE' : null,
      required: true,
    };
  });

async function seed() {
  const levels = Array.from({ length: 500 }, (_, offset) => {
    const index = offset + 1;
    const world = Math.ceil(index / 50);
    const type = index % 50 === 0 ? 'WORLD_BOSS' : index % 10 === 0 ? 'MINI_BOSS' : 'NORMAL';
    const definition = {
      version: 1,
      name: `Tuğla ${index}`,
      type,
      world,
      index,
      theme: worldThemes[(world - 1) % worldThemes.length] ?? 'neon-grid',
      seed: Number.parseInt(
        createHash('sha256').update(`tugla:${index}`).digest('hex').slice(0, 7),
        16,
      ),
      blocks: makeBlocks(index),
      metadata: {
        tutorial: index <= 5,
        boss: type !== 'NORMAL',
      },
    };
    return {
      slug: `level-${index}`,
      name: definition.name,
      world,
      index,
      type,
      theme: definition.theme,
      status: 'PUBLISHED' as const,
      definition,
      difficulty: 1 + index / 80,
      estimatedSeconds: type === 'WORLD_BOSS' ? 420 : type === 'MINI_BOSS' ? 300 : 180,
      publishedAt: new Date(),
    };
  });

  for (const level of levels) {
    await prisma.level.upsert({
      where: { slug: level.slug },
      update: level,
      create: level,
    });
  }

  const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: adminEmail.toLowerCase() },
      update: { role: UserRole.SUPER_ADMIN, passwordHash },
      create: {
        email: adminEmail.toLowerCase(),
        username: 'tugla-admin',
        displayName: 'Tugla Admin',
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        emailVerifiedAt: new Date(),
        acceptedTermsAt: new Date(),
      },
    });
  }

  const tasks = [
    ['daily-blocks', 'Block Breaker', 'Break 200 blocks', 'DAILY', 200, 'BLOCK_DESTROYED'],
    ['daily-levels', 'Clean Sweep', 'Complete 3 levels', 'DAILY', 3, 'LEVEL_COMPLETED'],
    ['weekly-boss', 'Core Hunter', 'Defeat 5 bosses', 'WEEKLY', 5, 'BOSS_DEFEATED'],
  ] as const;

  for (const [key, name, description, cadence, target, eventType] of tasks) {
    await prisma.taskDefinition.upsert({
      where: { key },
      update: {},
      create: {
        key,
        name,
        description,
        cadence,
        target,
        eventType,
        rewards: { credits: target * 10 },
      },
    });
  }

  const achievements = [
    ['first-clear', 'First Light', 'Complete a level', 'PROGRESS', 1, 'LEVEL_COMPLETED'],
    ['hundred-balls', 'Particle Storm', 'Reach 100 balls', 'MULTIBALL', 100, 'MAX_BALLS'],
    ['boss-one', 'Core Breach', 'Defeat a world boss', 'BOSS', 1, 'BOSS_DEFEATED'],
  ] as const;

  for (const [key, name, description, category, target, eventType] of achievements) {
    await prisma.achievement.upsert({
      where: { key },
      update: {},
      create: {
        key,
        name,
        description,
        category,
        target,
        eventType,
        rewards: { crystals: 25 },
      },
    });
  }

  await prisma.featureFlag.upsert({
    where: { key: 'monetization' },
    update: {},
    create: {
      key: 'monetization',
      description: 'Ads and real-money purchases',
      enabled: false,
      config: { requiresProviderCredentials: true },
    },
  });
}

seed()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
