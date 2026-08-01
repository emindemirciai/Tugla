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

interface CellContext {
  row: number;
  column: number;
  rows: number;
  columns: number;
}

/** A cell is empty, part of the body, or part of the pattern's accent edge. */
type Cell = false | 'body' | 'accent';

interface Layout {
  name: string;
  /** Solid layouts skip the random thinning so the silhouette stays crisp. */
  solid?: boolean;
  /** Horizontal offset in columns, for staggered brickwork. */
  offsetRow?: (row: number) => number;
  cell: (context: CellContext) => Cell;
}

/**
 * Level silhouettes.
 *
 * Levels used to be one rectangle filled at random, which is why every board
 * looked alike. Each layout below draws a different shape and marks an accent
 * edge, so the tougher block kinds trace the outline instead of appearing as
 * noise. The layout is chosen by level index, so it stays deterministic and the
 * server verification generates the identical board.
 */
const LAYOUTS: Layout[] = [
  {
    name: 'wall',
    cell: ({ row, rows }) => (row === 0 || row === rows - 1 ? 'accent' : 'body'),
  },
  {
    name: 'brickwork',
    offsetRow: (row) => (row % 2 === 0 ? 0 : 0.5),
    cell: ({ row, column, columns }) =>
      row % 2 === 1 && column === columns - 1 ? false : row === 0 ? 'accent' : 'body',
  },
  {
    name: 'pyramid',
    solid: true,
    cell: ({ row, column, columns }) => {
      const inset = Math.floor((columns / 2) * (1 - row / 4));
      if (column < inset || column > columns - 1 - inset) return false;
      return column === inset || column === columns - 1 - inset ? 'accent' : 'body';
    },
  },
  {
    name: 'diamond',
    solid: true,
    cell: ({ row, column, rows, columns }) => {
      const centreRow = (rows - 1) / 2;
      const centreColumn = (columns - 1) / 2;
      const reach = Math.abs(row - centreRow) + Math.abs(column - centreColumn) * 0.75;
      if (reach > centreRow + 1.2) return false;
      return reach > centreRow + 0.2 ? 'accent' : 'body';
    },
  },
  {
    name: 'columns',
    solid: true,
    cell: ({ column }) => (column % 3 === 1 ? false : column % 3 === 0 ? 'accent' : 'body'),
  },
  {
    name: 'fortress',
    solid: true,
    cell: ({ row, column, rows, columns }) => {
      const edge = row === 0 || row === rows - 1 || column === 0 || column === columns - 1;
      if (edge) return 'accent';
      const inner = row > 1 && row < rows - 2 && column > 1 && column < columns - 2;
      return inner ? 'body' : false;
    },
  },
  {
    name: 'wave',
    cell: ({ row, column, columns }) => {
      const crest = Math.round(1.5 + Math.sin((column / columns) * Math.PI * 2) * 1.5);
      if (row < crest) return false;
      return row === crest ? 'accent' : 'body';
    },
  },
  {
    name: 'checker',
    solid: true,
    cell: ({ row, column }) =>
      (row + column) % 2 === 0 ? ((row + column) % 4 === 0 ? 'accent' : 'body') : false,
  },
  {
    name: 'gate',
    solid: true,
    cell: ({ row, column, rows, columns }) => {
      const middle = column >= columns / 2 - 1 && column <= columns / 2;
      if (middle && row > rows - 3) return false;
      return middle || column === 0 || column === columns - 1 ? 'accent' : 'body';
    },
  },
  {
    name: 'rings',
    solid: true,
    cell: ({ row, column, rows, columns }) => {
      const ring = Math.min(row, rows - 1 - row, column, columns - 1 - column);
      if (ring % 2 === 1) return false;
      return ring === 0 ? 'accent' : 'body';
    },
  },
];

/**
 * Picks a block kind for a cell. The top rows and the pattern's accent edge get
 * the tougher members of the world pool, so difficulty reads visually instead of
 * being scattered at random.
 */
const kindForCell = ({
  pool,
  row,
  accent,
  random,
}: {
  pool: BlockKind[];
  row: number;
  column: number;
  rows: number;
  columns: number;
  accent: boolean;
  random: () => number;
}): BlockKind => {
  const specials = pool.filter((kind) => kind !== 'NORMAL');
  if (!specials.length) return 'NORMAL';
  if (accent) return specials[Math.floor(random() * specials.length)] ?? 'NORMAL';
  // Deeper rows stay softer so there is always a way into the board.
  const chance = row === 0 ? 0.55 : row === 1 ? 0.3 : 0.12;
  return random() < chance
    ? (specials[Math.floor(random() * specials.length)] ?? 'NORMAL')
    : 'NORMAL';
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
  // index alone would put every 10th level (the mini bosses) on the same
  // silhouette, so the world is mixed into the choice.
  const layout = LAYOUTS[(index + world * 3) % LAYOUTS.length]!;

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
      const cell = layout.cell({ row, column, rows, columns });
      if (!cell) continue;

      // A little noise keeps levels from looking machine-stamped, but the
      // pattern always wins: the shape has to stay readable.
      if (random() > 0.94 && !layout.solid) continue;

      const y = (type === 'NORMAL' ? 0.84 : 0.74) - row * 0.055;
      if (y <= 0.24) continue;

      const kind = kindForCell({
        pool,
        row,
        column,
        rows,
        columns,
        accent: cell === 'accent',
        random,
      });
      const bonusRoll = random();
      blocks.push({
        id: `l${index}-r${row}c${column}`,
        kind,
        x: 0.08 + (column + (layout.offsetRow?.(row) ?? 0)) * 0.12,
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
    metadata: {
      tutorial: index <= 5,
      boss: type !== 'NORMAL',
      generated: true,
      layout: layout.name,
    },
  };
};

export const createDemoLevel = (): LevelDefinition => generateCampaignLevel(1);
