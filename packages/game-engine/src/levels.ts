import {
  APP_DEFAULTS,
  isIndestructibleBlock,
  levelTypeForIndex,
  weightedBonusPool,
  worldThemes,
  type BlockKind,
  type BonusKind,
  type LevelDefinition,
  type LevelType,
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
    ['NORMAL', 'TOUGH', 'SHIELDED', 'ELECTRIC'],
    ['NORMAL', 'ARMORED', 'ABSORBER', 'REGENERATING'],
    ['NORMAL', 'TOUGH', 'ARMORED', 'SHIELDED', 'EXPLOSIVE', 'PORTAL'],
  ];
  return pools[Math.min(pools.length - 1, world - 1)] ?? pools[0]!;
};

/**
 * Bonus authoring pool, expanded from the shared weights.
 *
 * The weights live in `@tugla/shared` so the generator, the admin editor and
 * the seed script cannot drift apart on what a level is allowed to contain.
 */
const bonusPool: BonusKind[] = weightedBonusPool();

/**
 * A wall the ball cannot break, with one opening.
 *
 * Boss rooms and the late-campaign gauntlet levels put an indestructible
 * barrier between the paddle and the bricks: the only way up is to thread the
 * ball through the gate. It changes what the player is doing — aiming for a gap
 * instead of sweeping a wall — without adding a single new mechanic to the
 * engine, because DEFLECTOR blocks already reflect without taking damage.
 */
export interface BarrierPlan {
  /** Normalized y of the barrier row. */
  y: number;
  /** First open column of the gate. */
  gapColumn: number;
  /** Gate width, in columns. */
  gapWidth: number;
  /** World bosses get a second row with the gate on the far side. */
  double: boolean;
  /**
   * Whether the wall slides, carrying its gate with it.
   *
   * A static gate is an aiming problem the player solves once. A moving one has
   * to be re-solved every rally, which is the difference between a boss room
   * and a slower level — so it is reserved for the fights.
   */
  slide: boolean;
}

/** Columns across the board. Bricks and barriers share the pitch. */
const COLUMNS = 8;

/** Column pitch in normalized units. */
const COLUMN_PITCH = 0.12;

/**
 * How far a sliding wall travels each way, in normalized units.
 *
 * Half a column. The wall is authored one segment wider than the board on each
 * side, so at any point in the travel the playfield is still fully walled and
 * only the gate has moved.
 */
const BARRIER_TRAVEL = COLUMN_PITCH / 2;

/**
 * Decides whether a level is gated, and how.
 *
 * Deterministic in the level index, so the client, the admin preview and the
 * server's verification run all build the identical board. Exported so a test
 * can assert the campaign's difficulty curve rather than trusting a comment:
 * no gates while the game is still teaching, every boss room gated, and a
 * recurring gauntlet once the player has seen everything.
 */
export const barrierPlanFor = (
  index: number,
  type: LevelType,
  random: () => number,
): BarrierPlan | null => {
  const boss = type === 'MINI_BOSS' || type === 'WORLD_BOSS';
  // Gauntlet levels start deep into world 3 — by then the player has met every
  // block kind, and a gate reads as a new challenge rather than a wall they do
  // not understand.
  const gauntlet = index >= 120 && index % 12 === 5;
  if (!boss && !gauntlet) return null;

  // A world boss gets the narrow gate; everything else gets two columns, which
  // is about ten ball diameters and can be hit deliberately rather than by luck.
  const gapWidth = type === 'WORLD_BOSS' ? 1 : 2;
  const gapColumn = Math.floor(random() * (COLUMNS - gapWidth));

  return {
    y: boss ? 0.3 : 0.36,
    gapColumn,
    gapWidth,
    double: type === 'WORLD_BOSS',
    // Mini bosses hold still: the gate is already a new idea there, and moving
    // it in the same level the player first meets it is two lessons at once.
    slide: type === 'WORLD_BOSS' || (!boss && gauntlet),
  };
};

/** Builds the barrier rows for a plan. */
const barrierBlocks = (index: number, plan: BarrierPlan): LevelDefinition['blocks'] => {
  const blocks: LevelDefinition['blocks'] = [];
  const rows: { y: number; gapColumn: number; tag: string; phase: number }[] = [
    { y: plan.y, gapColumn: plan.gapColumn, tag: 'a', phase: 0 },
  ];
  if (plan.double) {
    // Gate on the far side, so the two openings are never stacked: the ball has
    // to cross the corridor between the rows to get up. The half-turn phase
    // offset makes the rows slide in opposition, which keeps the corridor
    // opening and closing rather than translating rigidly.
    const mirrored = COLUMNS - plan.gapWidth - plan.gapColumn;
    rows.push({
      y: plan.y - 0.075,
      gapColumn: Math.max(0, mirrored),
      tag: 'b',
      phase: Math.PI,
    });
  }

  for (const row of rows) {
    // A sliding wall overhangs one segment past each edge, so the board stays
    // fully walled at every point in the travel and only the gate moves.
    const first = plan.slide ? -1 : 0;
    const last = plan.slide ? COLUMNS : COLUMNS - 1;
    for (let column = first; column <= last; column += 1) {
      if (column >= row.gapColumn && column < row.gapColumn + plan.gapWidth) continue;
      blocks.push({
        id: `l${index}-bar${row.tag}c${column}`,
        kind: 'DEFLECTOR',
        x: 0.08 + column * COLUMN_PITCH,
        y: row.y,
        // Slightly wider than a brick so the row is a seamless wall: at the
        // brick width of 0.102 the 0.018 seams are narrower than the ball, but
        // a discrete collision test should never have to rely on that.
        width: 0.118,
        height: 0.038,
        // Never read — a DEFLECTOR reflects before any damage is applied — but
        // the schema requires a positive value.
        hitPoints: 1,
        rotation: 0,
        bonus: null,
        // The wall is scenery, not a target: it must not hold the level open.
        required: false,
        ...(plan.slide
          ? {
              motionRange: BARRIER_TRAVEL,
              motionSpeed: 0.55,
              // Every segment of a row shares one phase, so the wall travels as
              // a single piece. Without this the engine derives the phase from
              // each block's position and the wall tears apart around its gate.
              motionPhase: row.phase,
            }
          : {}),
      });
    }
  }
  return blocks;
};

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
/**
 * Brick kinds must be destructible.
 *
 * A required brick that cannot be destroyed makes its level impossible to
 * finish, and because progression is sequential that would stop every player
 * there forever. Barriers are placed deliberately by `barrierPlanFor` with
 * `required: false`; the brick generator must never reach for one.
 *
 * World 8's pool listed DEFLECTOR once. It was harmless while the kind merely
 * reflected — and became fifty unwinnable levels the moment it stopped taking
 * damage. This guard is why that cannot happen silently again.
 */
const assertDestructible = (kind: BlockKind): BlockKind => {
  if (isIndestructibleBlock(kind)) {
    throw new Error(`${kind} is indestructible and cannot be used as a brick kind`);
  }
  return kind;
};

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
  // Filtered, not just excluded: a pool that lists an indestructible kind is a
  // configuration mistake and must not be able to reach a brick.
  const specials = pool.filter((kind) => kind !== 'NORMAL' && !isIndestructibleBlock(kind));
  if (!specials.length) return 'NORMAL';
  if (accent)
    return assertDestructible(specials[Math.floor(random() * specials.length)] ?? 'NORMAL');
  // Deeper rows stay softer so there is always a way into the board.
  const chance = row === 0 ? 0.55 : row === 1 ? 0.3 : 0.12;
  return random() < chance
    ? assertDestructible(specials[Math.floor(random() * specials.length)] ?? 'NORMAL')
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

  const columns = COLUMNS;
  const rows = Math.min(9, 4 + Math.floor(index / 60));
  const blocks: LevelDefinition['blocks'] = [];
  // index alone would put every 10th level (the mini bosses) on the same
  // silhouette, so the world is mixed into the choice.
  const layout = LAYOUTS[(index + world * 3) % LAYOUTS.length]!;
  const barrier = barrierPlanFor(index, type, random);
  // Bricks must stop clear of the barrier, or the wall and the lowest brick row
  // would occupy the same space.
  const floorY = barrier ? barrier.y + 0.045 : 0.24;

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
      if (y <= floorY) continue;

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

  // A silhouette can be thin — the pyramid bottoms out at twelve bricks — and a
  // board that thin is cleared on the first rally. Fill the upper rows until the
  // level is worth playing. The extra bricks draw from the same deterministic
  // random stream, so server verification rebuilds the identical board.
  const minimumBlocks = Math.min(34, 18 + Math.floor(index / 40));
  const occupied = new Set(blocks.map((block) => `${block.x.toFixed(3)}:${block.y.toFixed(3)}`));
  for (let row = 0; blocks.length < minimumBlocks && row < rows; row += 1) {
    for (let column = 0; column < columns && blocks.length < minimumBlocks; column += 1) {
      const x = 0.08 + column * 0.12;
      const y = (type === 'NORMAL' ? 0.84 : 0.74) - row * 0.055;
      if (y <= floorY) continue;
      const key = `${x.toFixed(3)}:${y.toFixed(3)}`;
      if (occupied.has(key)) continue;
      occupied.add(key);
      blocks.push({
        id: `l${index}-fill${row}c${column}`,
        kind: 'NORMAL',
        x,
        y,
        width: 0.102,
        height: 0.038,
        hitPoints: hitPointsFor('NORMAL', index),
        rotation: 0,
        bonus: random() > 0.9 ? (bonusPool[Math.floor(random() * bonusPool.length)] ?? null) : null,
        required: true,
      });
    }
  }

  // The barrier goes on last, after the minimum-brick fill: it is not a target,
  // so it must not count towards the level being "worth playing".
  if (barrier) blocks.push(...barrierBlocks(index, barrier));

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
      barrier: barrier ?? null,
    },
  };
};

export const createDemoLevel = (): LevelDefinition => generateCampaignLevel(1);
