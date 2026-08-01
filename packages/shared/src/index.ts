import { z } from 'zod';

export * from './brand';
export * from './checksum';
export * from './replay';

export const APP_DEFAULTS = {
  name: process.env.APP_NAME ?? 'Tuğla.fun',
  slug: process.env.APP_SLUG ?? 'tugla',
  livesPerLevel: 3,
  maxBalls: 500,
  worlds: 10,
  levelsPerWorld: 50,
  miniBossEvery: 10,
  worldBossEvery: 50,
} as const;

export const currencies = ['CREDITS', 'CRYSTALS'] as const;
export type Currency = (typeof currencies)[number];

export const levelTypes = ['NORMAL', 'MINI_BOSS', 'WORLD_BOSS', 'DAILY', 'COMMUNITY'] as const;
export type LevelType = (typeof levelTypes)[number];

export const levelStatuses = ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED', 'REJECTED'] as const;
export type LevelStatus = (typeof levelStatuses)[number];

export const gameModes = [
  'CAMPAIGN',
  'DAILY',
  'LEAGUE',
  'COMMUNITY',
  'BOSS_RUSH',
  'ENDLESS',
] as const;
export type GameMode = (typeof gameModes)[number];

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
  'SAFETY_NET',
] as const;

export type BonusKind = (typeof bonusKinds)[number];

export const qualityLevels = ['LOW', 'MEDIUM', 'HIGH', 'AUTO'] as const;
export type QualityLevel = (typeof qualityLevels)[number];

export const userRoles = [
  'PLAYER',
  'SUPPORT',
  'ANALYST',
  'CONTENT_EDITOR',
  'GAME_ADMIN',
  'SUPER_ADMIN',
] as const;
export type UserRoleName = (typeof userRoles)[number];

/** Roles allowed to reach the administration surface at all. */
export const staffRoles = [
  'SUPPORT',
  'ANALYST',
  'CONTENT_EDITOR',
  'GAME_ADMIN',
  'SUPER_ADMIN',
] as const;

const passwordField = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .refine((value) => /[a-zA-Z]/.test(value) && /[0-9\W_]/.test(value), {
    message: 'Password must mix letters with a number or symbol',
  });

const emailField = z
  .string()
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1).max(128),
  deviceName: z.string().trim().min(1).max(60).optional(),
});

export const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  displayName: z.string().trim().min(2).max(40),
  locale: z.enum(['tr', 'en']).default('tr'),
  acceptedTerms: z.literal(true),
  marketingConsent: z.boolean().default(false),
  deviceName: z.string().trim().min(1).max(60).optional(),
});

export const requestEmailVerificationSchema = z.object({ email: emailField });
export const confirmTokenSchema = z.object({ token: z.string().min(20).max(200) });

/** Length of the e-mail verification code sent on sign-up. */
export const VERIFICATION_CODE_LENGTH = 6;

/**
 * E-mail verification accepts either the one-click link token or the short code
 * from the same message; both resolve to the same single-use credential.
 */
export const confirmVerificationSchema = z.union([
  confirmTokenSchema,
  z.object({
    email: z.string().email().max(254).toLowerCase(),
    code: z
      .string()
      .trim()
      .regex(new RegExp(`^\\d{${VERIFICATION_CODE_LENGTH}}$`), 'Code must be 6 digits'),
  }),
]);
export const requestPasswordResetSchema = z.object({ email: emailField });
export const confirmPasswordResetSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordField,
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordField,
});

export const oauthSchema = z.object({
  provider: z.enum(['google', 'apple']),
  identityToken: z.string().min(40).max(8192),
  displayName: z.string().trim().min(2).max(40).optional(),
  deviceName: z.string().trim().min(1).max(60).optional(),
});

/** Links an additional provider to the currently authenticated account. */
export const linkProviderSchema = z.object({
  provider: z.enum(['google', 'apple']),
  identityToken: z.string().min(40).max(8192),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(40).optional(),
  locale: z.enum(['tr', 'en']).optional(),
  searchVisible: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
});

export const levelBlockSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(blockKinds),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
  hitPoints: z.number().int().positive().max(1000000),
  rotation: z.number().finite().default(0),
  bonus: z.enum(bonusKinds).nullable().optional(),
  required: z.boolean().default(true),
  /** Horizontal patrol distance in normalized units for MOVING blocks. */
  motionRange: z.number().min(0).max(1).optional(),
  motionSpeed: z.number().min(0).max(4).optional(),
});

export const levelDefinitionSchema = z.object({
  version: z.number().int().positive(),
  name: z.string().trim().min(1).max(80),
  type: z.enum(levelTypes),
  world: z.number().int().min(1).max(1000),
  index: z.number().int().min(1).max(1000000),
  theme: z.string().min(1).max(40),
  seed: z.number().int().nonnegative(),
  blocks: z.array(levelBlockSchema).min(1).max(500),
  metadata: z.record(z.unknown()).default({}),
});

export type LevelDefinition = z.infer<typeof levelDefinitionSchema>;
export type LevelBlock = z.infer<typeof levelBlockSchema>;

export const levelResultSchema = z.object({
  sessionId: z.string().uuid(),
  score: z.number().int().nonnegative().max(1000000000),
  durationMs: z.number().int().positive().max(3600000),
  livesRemaining: z.number().int().min(0).max(5),
  maxBalls: z.number().int().min(1).max(APP_DEFAULTS.maxBalls),
  blocksDestroyed: z.number().int().nonnegative(),
  bossDefeated: z.boolean().default(false),
  completed: z.boolean(),
  checksum: z.string().length(64),
  eventCount: z.number().int().nonnegative().max(1000000),
  finalTick: z.number().int().nonnegative().max(100000000),
  replay: z.string().max(400000).optional(),
});

export type LevelResult = z.infer<typeof levelResultSchema>;

export const pageSchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const supportTicketSchema = z.object({
  email: emailField,
  category: z.enum(['account', 'gameplay', 'purchase', 'report', 'other']),
  subject: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(5000),
  deviceInfo: z.record(z.unknown()).optional(),
});

export const moderationReportSchema = z.object({
  targetType: z.enum(['USER', 'LEVEL', 'REPLAY']),
  targetId: z.string().min(1).max(64),
  reason: z.enum(['CHEATING', 'ABUSE', 'SPAM', 'INAPPROPRIATE', 'OTHER']),
  details: z.string().trim().max(2000).optional(),
});

export const purchaseIntentSchema = z.object({
  sku: z.string().min(1).max(80),
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

export type WorldTheme = (typeof worldThemes)[number];

export const worldNames: Record<WorldTheme, string> = {
  'neon-grid': 'Neon Grid',
  'crystal-core': 'Crystal Core',
  'frozen-circuit': 'Frozen Circuit',
  'solar-forge': 'Solar Forge',
  'deep-space': 'Deep Space',
  'quantum-lab': 'Quantum Lab',
  'dark-matter': 'Dark Matter',
  'golden-nexus': 'Golden Nexus',
  'aether-garden': 'Aether Garden',
  singularity: 'Singularity',
};

/** Level type for a campaign index, matching the seeded 500-level campaign. */
export const levelTypeForIndex = (index: number): LevelType =>
  index % APP_DEFAULTS.worldBossEvery === 0
    ? 'WORLD_BOSS'
    : index % APP_DEFAULTS.miniBossEvery === 0
      ? 'MINI_BOSS'
      : 'NORMAL';
