import type { BonusKind } from '@tugla/shared';

/**
 * Falling bonuses stay readable at phone size through a stable colour language:
 * cyan for extra balls, warm colours for damage, violet for control and green
 * for protection. Nearby effects still get a slightly different shade.
 */
const BONUS_COLORS: Partial<Record<BonusKind, number>> = {
  BALL_1: 0x8be0ff,
  BALL_3: 0x62caf7,
  BALL_5: 0x45a9e8,
  BALL_DOUBLE: 0x8b7bff,
  FIREBALL: 0xff7a45,
  PIERCING: 0xffb45e,
  EXPLOSIVE: 0xff5f7f,
  CHAIN_LIGHTNING: 0xffd166,
  GIANT_BALL: 0xff9a6b,
  LASER: 0xff6bb5,
  PADDLE_GROW: 0xc7a8ff,
  MAGNET: 0xb585f5,
  SLOW_TIME: 0x76d7ee,
  STICKY: 0x9a83e8,
  SHIELD: 0x6ee7b7,
  LIFE_GUARD: 0x8cf0a4,
  SAFETY_NET: 0x4fd6a8,
};

export function bonusColor(kind: BonusKind): number {
  // RANDOM is normally resolved by the engine before a token begins falling.
  // Keep a neutral fallback so a replay or older payload can never render black.
  return BONUS_COLORS[kind] ?? 0xd8ffe9;
}
