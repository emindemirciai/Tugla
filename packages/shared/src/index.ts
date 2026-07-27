import { z } from 'zod';

export const APP_DEFAULTS = {
  name: process.env.APP_NAME ?? 'Pulse',
  slug: process.env.APP_SLUG ?? 'pulse',
  livesPerLevel: 5,
  maxBalls: 500,
  worlds: 10,
  levelsPerWorld: 50,
} as const;

export const currencies = ['CREDITS', 'CRYSTALS'] as const;
export type Currency = (typeof currencies)[number];

export const levelTypes = ['NORMAL', 'MINI_BOSS', 'WORLD_BOSS', 'DAILY', 'COMMUNITY'] as const;
export type LevelType = (typeof levelTypes)[number];

export const blockKinds = [
  'NORMAL',
  'TOUGH',
  'ARMORED',
  'EXPLOSIVE',
  'ICE',
  'FIRE',
  'ELECTRIC',
  'MOVING',
  'REGENERATING',
  'SHIELDED',
  'PORTAL',
  'SPLITTER',
  'BONUS',
  'DEFLECTOR',
  'ABSORBER',
  'BOSS_CORE',
] as const;

export type BlockKind = (typeof blockKinds)[number];

export const bonusKinds = [
  'BALL_1',
  'BALL_3',
  'BALL_5',
  'BALL_DOUBLE',
  'FIREBALL',
  'PIERCING',
  'EXPLOSIVE',
  'CHAIN_LIGHTNING',
  'GIANT_BALL',
  'LASER',
  'PADDLE_GROW',
  'MAGNET',
  'SLOW_TIME',
  'STICKY',
  'SHIELD',
  'LIFE_GUARD',
] as const;

export type BonusKind = (typeof bonusKinds)[number];

export const loginSchema = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(128),
});

export const registerSchema = loginSchema.extend({
  displayName: z.string().trim().min(2).max(40),
  locale: z.enum(['tr', 'en']).default('tr'),
  acceptedTerms: z.literal(true),
});

export const levelBlockSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(blockKinds),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
  hitPoints: z.number().int().positive().max(1_000_000),
  rotation: z.number().finite().default(0),
  bonus: z.enum(bonusKinds).nullable().optional(),
  required: z.boolean().default(true),
});

export const levelDefinitionSchema = z.object({
  version: z.number().int().positive(),
  name: z.string().trim().min(1).max(80),
  type: z.enum(levelTypes),
  world: z.number().int().min(1).max(1000),
  index: z.number().int().min(1).max(1_000_000),
  theme: z.string().min(1).max(40),
  seed: z.number().int().nonnegative(),
  blocks: z.array(levelBlockSchema).min(1).max(500),
  metadata: z.record(z.unknown()).default({}),
});

export type LevelDefinition = z.infer<typeof levelDefinitionSchema>;

export const levelResultSchema = z.object({
  sessionId: z.string().uuid(),
  levelId: z.string().uuid(),
  score: z.number().int().nonnegative(),
  durationMs: z.number().int().positive().max(3_600_000),
  livesRemaining: z.number().int().min(0).max(5),
  maxBalls: z.number().int().min(1).max(APP_DEFAULTS.maxBalls),
  blocksDestroyed: z.number().int().nonnegative(),
  checksum: z.string().min(32).max(256),
  eventCount: z.number().int().nonnegative().max(1_000_000),
});

export const pageSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export interface ApiEnvelope<T> {
  data: T;
  requestId: string;
}

export const worldThemes = [
  'neon-grid',
  'crystal-core',
  'frozen-circuit',
  'solar-forge',
  'deep-space',
  'quantum-lab',
  'dark-matter',
  'golden-nexus',
  'aether-garden',
  'singularity',
] as const;
