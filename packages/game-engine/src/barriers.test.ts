import {
  isIndestructibleBlock,
  bonusKinds,
  isBallBonus,
  weightedBonusPool,
  type BonusKind,
} from '@tugla/shared';
import { describe, expect, it } from 'vitest';
import { TuğlaEngine } from './engine';
import { barrierPlanFor, generateCampaignLevel } from './levels';

const COLUMN_OF = (x: number) => Math.round((x - 0.08) / 0.12);

describe('indestructible barriers', () => {
  it('gates every boss room and leaves the teaching levels open', () => {
    const never = () => 0.5;
    expect(barrierPlanFor(3, 'NORMAL', never)).toBeNull();
    expect(barrierPlanFor(41, 'NORMAL', never)).toBeNull();
    expect(barrierPlanFor(10, 'MINI_BOSS', never)).not.toBeNull();
    expect(barrierPlanFor(50, 'WORLD_BOSS', never)).not.toBeNull();
    // Gauntlet levels only once the campaign has shown every block kind.
    expect(barrierPlanFor(125, 'NORMAL', never)).not.toBeNull();
  });

  it('builds a wall with exactly one gate, and never counts it towards clearing', () => {
    const level = generateCampaignLevel(10);
    const barriers = level.blocks.filter((block) => block.kind === 'DEFLECTOR');

    expect(barriers.length).toBeGreaterThan(0);
    expect(barriers.every((block) => block.required === false)).toBe(true);

    // Eight columns, a two-column gate: six segments, and the gate is contiguous.
    const columns = barriers.map((block) => COLUMN_OF(block.x)).sort((a, b) => a - b);
    expect(columns).toHaveLength(6);
    const missing = [0, 1, 2, 3, 4, 5, 6, 7].filter((column) => !columns.includes(column));
    expect(missing).toHaveLength(2);
    expect(missing[1]! - missing[0]!).toBe(1);
  });

  it('keeps every brick clear of the barrier row', () => {
    for (const index of [10, 20, 50, 125]) {
      const level = generateCampaignLevel(index);
      const barriers = level.blocks.filter((block) => block.kind === 'DEFLECTOR');
      if (!barriers.length) continue;
      const wallTop = Math.max(...barriers.map((block) => block.y));
      const bricks = level.blocks.filter((block) => block.kind !== 'DEFLECTOR');
      expect(Math.min(...bricks.map((block) => block.y))).toBeGreaterThan(wallTop);
    }
  });

  it('offsets the two gates of a world boss so they are never stacked', () => {
    const level = generateCampaignLevel(50);
    const barriers = level.blocks.filter((block) => block.kind === 'DEFLECTOR');
    const rows = [...new Set(barriers.map((block) => block.y))];
    expect(rows).toHaveLength(2);

    const gateOf = (y: number) => {
      const taken = barriers.filter((block) => block.y === y).map((block) => COLUMN_OF(block.x));
      return [0, 1, 2, 3, 4, 5, 6, 7].filter((column) => !taken.includes(column));
    };
    expect(gateOf(rows[0]!)).not.toEqual(gateOf(rows[1]!));
  });

  it('slides a boss wall as one piece, overhanging both edges', () => {
    const level = generateCampaignLevel(50);
    const barriers = level.blocks.filter((block) => block.kind === 'DEFLECTOR');

    // Every segment moves, and every segment of a row shares one phase — that
    // is what keeps the wall rigid instead of tearing open around its gate.
    expect(barriers.every((block) => (block.motionRange ?? 0) > 0)).toBe(true);
    const topRow = Math.max(...barriers.map((block) => block.y));
    const phases = new Set(
      barriers.filter((block) => block.y === topRow).map((block) => block.motionPhase),
    );
    expect(phases.size).toBe(1);

    // Authored past both edges, so the playfield stays walled while it travels.
    const columns = barriers
      .filter((block) => block.y === topRow)
      .map((block) => COLUMN_OF(block.x));
    expect(Math.min(...columns)).toBe(-1);
    expect(Math.max(...columns)).toBe(8);
  });

  it('keeps a sliding wall rigid once the simulation runs', () => {
    const engine = new TuğlaEngine(generateCampaignLevel(50), { recordReplay: false });
    const wall = engine.snapshot.blocks.filter((block) => block.kind === 'DEFLECTOR');
    const topRow = Math.max(...wall.map((block) => block.position.y));
    const row = wall.filter((block) => block.position.y === topRow);

    const spacingAt = () => {
      const sorted = [...row].sort((a, b) => a.position.x - b.position.x);
      return sorted
        .slice(1)
        .map((block, i) => Number((block.position.x - sorted[i]!.position.x).toFixed(4)));
    };

    const before = spacingAt();
    engine.launch({ record: false });
    for (let index = 0; index < 200; index += 1) engine.step();

    // It has actually moved…
    expect(row.some((block) => block.position.x !== block.origin.x)).toBe(true);
    // …and the gaps between segments are unchanged, so the gate is intact.
    expect(spacingAt()).toEqual(before);
  });

  it('leaves a mini boss wall static', () => {
    const level = generateCampaignLevel(10);
    const barriers = level.blocks.filter((block) => block.kind === 'DEFLECTOR');
    expect(barriers.every((block) => (block.motionRange ?? 0) === 0)).toBe(true);
  });

  it('completes a gated level while the wall is still standing', () => {
    const engine = new TuğlaEngine(generateCampaignLevel(10), { recordReplay: false });
    const wall = engine.snapshot.blocks.filter((block) => block.kind === 'DEFLECTOR');
    expect(wall.length).toBeGreaterThan(0);

    for (const block of engine.snapshot.blocks) {
      if (!block.required) continue;
      block.active = false;
      block.regenTicks = 0;
    }
    engine.launch({ record: false });
    engine.step();

    expect(engine.snapshot.status).toBe('COMPLETED');
    // The wall is scenery: clearing the level must not have removed it.
    expect(wall.filter((block) => block.active)).toHaveLength(wall.length);
  });

  it('survives a blast that reaches it', () => {
    const engine = new TuğlaEngine(generateCampaignLevel(10), { recordReplay: false });
    const wall = engine.snapshot.blocks.filter((block) => block.kind === 'DEFLECTOR');
    const brick = engine.snapshot.blocks.find(
      (block) => block.required && block.kind !== 'BOSS_CORE',
    )!;

    // Park the blast right on top of the wall and set it off.
    brick.kind = 'EXPLOSIVE';
    brick.position.x = wall[0]!.position.x;
    brick.position.y = wall[0]!.position.y;
    brick.hitPoints = 1;

    engine.launch({ record: false });
    const ball = engine.snapshot.balls[0]!;
    ball.position.x = brick.position.x;
    ball.position.y = brick.position.y;
    engine.step();

    expect(wall.every((block) => block.active)).toBe(true);
  });
});

describe('bonus dynamics', () => {
  it('keeps extra balls a minority of the authoring pool', () => {
    const pool = weightedBonusPool();
    const balls = pool.filter((kind) => isBallBonus(kind)).length;
    // Four of seventeen kinds add balls; unweighted that was a quarter of every
    // drop, which is what made the pickups feel identical.
    expect(balls / pool.length).toBeLessThan(0.25);
    for (const kind of bonusKinds) expect(pool).toContain(kind);
  });

  it('never drops two ball bonuses in a row', () => {
    const level = generateCampaignLevel(1);
    // Every brick carries a ball swarm: without the drop filter this board would
    // produce nothing else.
    const engine = new TuğlaEngine(
      { ...level, blocks: level.blocks.map((block) => ({ ...block, bonus: 'BALL_3' as const })) },
      { recordReplay: false },
    );

    engine.launch({ record: false });
    const dropped: BonusKind[] = [];
    for (const block of engine.snapshot.blocks) {
      const before = engine.snapshot.bonuses.length;
      engine.dropBonus(block);
      if (engine.snapshot.bonuses.length > before) {
        dropped.push(engine.snapshot.bonuses.at(-1)!.kind);
      }
    }

    expect(dropped.length).toBeGreaterThan(4);
    for (let index = 1; index < dropped.length; index += 1) {
      expect(isBallBonus(dropped[index - 1]!) && isBallBonus(dropped[index]!)).toBe(false);
    }
  });

  it('banks a life above the starting allowance, then stops', () => {
    const engine = new TuğlaEngine(generateCampaignLevel(1), { recordReplay: false });
    expect(engine.snapshot.lives).toBe(3);
    engine.collectBonus('LIFE_GUARD', { record: false });
    expect(engine.snapshot.lives).toBe(4);
    for (let index = 0; index < 5; index += 1) {
      engine.collectBonus('LIFE_GUARD', { record: false });
    }
    expect(engine.snapshot.lives).toBe(5);
  });

  it('extends the paddle visibly and stacks to double', () => {
    const engine = new TuğlaEngine(generateCampaignLevel(1), { recordReplay: false });
    const base = engine.snapshot.paddle.baseWidth;
    engine.collectBonus('PADDLE_GROW', { record: false });
    expect(engine.snapshot.paddle.width).toBeCloseTo(base * 1.4, 5);
    for (let index = 0; index < 4; index += 1) {
      engine.collectBonus('PADDLE_GROW', { record: false });
    }
    expect(engine.snapshot.paddle.width).toBeCloseTo(base * 2, 5);
  });

  it('MAGNET steers a falling ball towards the paddle at unchanged speed', () => {
    const engine = new TuğlaEngine(generateCampaignLevel(1), { recordReplay: false });
    engine.launch({ record: false });
    engine.collectBonus('MAGNET', { record: false });

    const ball = engine.snapshot.balls[0]!;
    ball.position.x = 1;
    ball.position.y = 3;
    ball.velocity.x = 0;
    ball.velocity.y = -6;
    engine.snapshot.paddle.x = 7;
    engine.snapshot.paddle.targetX = 7;

    const speedBefore = Math.hypot(ball.velocity.x, ball.velocity.y);
    engine.step();

    expect(ball.velocity.x).toBeGreaterThan(0);
    expect(Math.hypot(ball.velocity.x, ball.velocity.y)).toBeCloseTo(speedBefore, 4);
  });

  it('LASER breaks the block above the paddle', () => {
    const engine = new TuğlaEngine(generateCampaignLevel(1), { recordReplay: false });
    engine.launch({ record: false });
    engine.collectBonus('LASER', { record: false });

    const target = engine.snapshot.blocks.find((block) => block.active && block.kind === 'NORMAL')!;
    engine.snapshot.paddle.x = target.position.x;
    engine.snapshot.paddle.targetX = target.position.x;

    // Park the ball well below the wall so only the laser can break anything.
    const ball = engine.snapshot.balls[0]!;
    ball.position.x = 0.5;
    ball.position.y = 2;
    ball.velocity.x = 0;
    ball.velocity.y = 0;

    const before = engine.snapshot.blocksDestroyed;
    for (let index = 0; index < 120; index += 1) engine.step();

    expect(engine.snapshot.blocksDestroyed).toBeGreaterThan(before);
  });
});

describe('every level stays finishable', () => {
  it('never makes a required brick indestructible', () => {
    // World 8's brick pool listed DEFLECTOR. Harmless while the kind merely
    // reflected — but once it stopped taking damage those bricks could never be
    // destroyed, and with sequential progression fifty levels would have stopped
    // every player permanently at 351.
    for (let index = 1; index <= 500; index += 1) {
      const stuck = generateCampaignLevel(index).blocks.filter(
        (block) => block.required && isIndestructibleBlock(block.kind),
      );
      expect(stuck, `level ${index} cannot be cleared`).toHaveLength(0);
    }
  });

  it('keeps barriers out of the required count', () => {
    const level = generateCampaignLevel(50);
    const barriers = level.blocks.filter((block) => block.kind === 'DEFLECTOR');
    expect(barriers.length).toBeGreaterThan(0);
    expect(barriers.every((block) => block.required === false)).toBe(true);
  });
});
