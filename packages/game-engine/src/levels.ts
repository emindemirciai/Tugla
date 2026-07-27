import {
  APP_DEFAULTS,
  levelTypeForIndex,
  worldThemes,
  type BlockKind,
  type BonusKind,
  type LevelDefinition,
} from '@tugla/shared';

/** Small deterministic PRNG so generated levels are stable across runs. */
const rng = (seed: number) => {
  let state = seed || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

/** Stable 32-bit hash used to derive per-level seeds without crypto. */
export const hashSeed = (input: string) => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const kindPoolForWorld = (world: number): BlockKind[] => {
  const pools: BlockKind[][] = [
    ['NORMAL', 'TOUGH'],
    ['NORMAL', 'TOUGH', 'EXPLOSIVE'],
    ['NORMAL', 'TOUGH', 'ICE', 'ARMORED'],
    ['NORMAL', 'TOUGH', 'FIRE', 'EXPLOSIVE'],
    ['NORMAL', 'ARMORED', 'MOVING', 'ELECTRIC'],
    ['NORMAL', 'TOUGH', 'REGENERATING', 'SPLITTER'],
    ['NORMAL', 'ARMORED', 'SHIELDED', 'PORTAL'],
    ['NORMAL', 'TOUGH', 'DEFLECTOR', 'ELECTRIC'],
    ['NORMAL', 'ARMORED', 'ABSORBER', 'REGENERATING'],
    ['NORMAL', 'TOUGH', 'ARMORED', 'SHIELDED', 'EXPLOSIVE', 'PORTAL'],
  ];
  return pools[Math.min(pools.length - 1, world - 1)] ?? pools[0]!;
};

const bonusPool: BonusKind[] = [
  'BALL_3',
  'BALL_5',
  'BALL_DOUBLE',
  'PADDLE_GROW',
  'FIREBALL',
  'PIERCING',
  'MAGNET',
  'SHIELD',
  'SLOW_TIME',
  'LASER',
  'CHAIN_LIGHTNING',
  'EXPLOSIVE',
];

const hitPointsFor = (kind: BlockKind, index: number) => {
  switch (kind) {
    case 'BOSS_CORE':
      return 40 + Math.floor(index / 2);
    case 'ARMORED':
      return 4 + Math.floor(index / 120);
    case 'TOUGH':
      return 2 + Math.floor(index / 200);
    case 'SHIELDED':
      return 3;
    case 'REGENERATING':
      return 2;
    default:
      return 1;
  }
};

/**
 * Generates the campaign level for a 1-based index. Keeping this in the engine
 * package means the API seed, the admin editor and the client all agree on
 * exactly what level N contains.
 */
export const generateCampaignLevel = (index: number): LevelDefinition => {
  const world = Math.ceil(index / APP_DEFAULTS.levelsPerWorld);
  const type = levelTypeForIndex(index);
  const seed = hashSeed(`${APP_DEFAULTS.slug}:level:${index}`);
  const random = rng(seed);
  const pool = kindPoolForWorld(world);
  const theme = worldThemes[(world - 1) % worldThemes.length] ?? 'neon-grid';

  const columns = 8;
  const rows = Math.min(9, 4 + Math.floor(index / 60));
  const blocks: LevelDefinition['blocks'] = [];

  if (type !== 'NORMAL') {
    blocks.push({
      id: `l${index}-core`,
      kind: 'BOSS_CORE',
      x: 0.5,
      y: 0.86,
      width: 0.26,
      height: 0.09,
      hitPoints: hitPointsFor('BOSS_CORE', index) * (type === 'WORLD_BOSS' ? 2 : 1),
      rotation: 0,
      bonus: 'BALL_5',
      required: true,
    });
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const density = 0.72 + Math.min(0.24, index / 900);
      if (random() > density) continue;
      const kind = pool[Math.floor(random() * pool.length)] ?? 'NORMAL';
      const y = (type === 'NORMAL' ? 0.84 : 0.74) - row * 0.055;
      if (y <= 0.24) continue;
      const bonusRoll = random();
      blocks.push({
        id: `l${index}-r${row}c${column}`,
        kind,
        x: 0.08 + column * 0.12,
        y,
        width: 0.102,
        height: 0.038,
        hitPoints: hitPointsFor(kind, index),
        rotation: 0,
        bonus:
          bonusRoll > 0.9 ? (bonusPool[Math.floor(random() * bonusPool.length)] ?? null) : null,
        required: true,
        ...(kind === 'MOVING'
          ? { motionRange: 0.06 + random() * 0.06, motionSpeed: 0.6 + random() }
          : {}),
      });
    }
  }

  if (!blocks.length) {
    blocks.push({
      id: `l${index}-fallback`,
      kind: 'NORMAL',
      x: 0.5,
      y: 0.7,
      width: 0.102,
      height: 0.038,
      hitPoints: 1,
      rotation: 0,
      bonus: null,
      required: true,
    });
  }

  return {
    version: 1,
    name: `${APP_DEFAULTS.name} ${index}`,
    type,
    world,
    index,
    theme,
    seed,
    blocks,
    metadata: { tutorial: index <= 5, boss: type !== 'NORMAL', generated: true },
  };
};

export const createDemoLevel = (): LevelDefinition => generateCampaignLevel(1);
