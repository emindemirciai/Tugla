import { bonusKinds, isBallBonus, weightedBonusPool, type BonusKind } from '@tugla/shared';
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

  it('never counts the wall towards clearing, whatever its shape', () => {
    // Every gated level in the campaign, so no shape escapes the assertion.
    for (const index of [10, 20, 30, 40, 50, 60, 125, 137, 149]) {
      const level = generateCampaignLevel(index);
      const barriers = level.blocks.filter((block) => block.kind === 'DEFLECTOR');
      expect(barriers.length, `level ${index} has no wall`).toBeGreaterThan(0);
      expect(
        barriers.every((block) => block.required === false),
        `level ${index} counts its wall as a target`,
      ).toBe(true);
    }
  });

  /**
   * Five shapes, because one was not enough.
   *
   * A single horizontal wall with a slot is ONE aiming problem: a player who has
   * solved it has solved every gated level in the game. These five each ask for
   * something different — a bank off the rail, a corridor, a chevron that
   * returns the ball at an angle, lanes worked one at a time.
   */
  it('offers five distinct barrier shapes', () => {
    // Driven through barrierPlanFor with controlled draws rather than sampled
    // from the campaign: the selection is seeded per level, so sampling would
    // make this test depend on how the PRNG happens to fall.
    const shapeAt = (roll: number) => barrierPlanFor(130, 'MINI_BOSS', () => roll)!.shape;
    expect(shapeAt(0.05)).toBe('gate');
    expect(shapeAt(0.3)).toBe('funnel');
    expect(shapeAt(0.6)).toBe('pillars');
    expect(shapeAt(0.85)).toBe('vault');
    // Every world boss is the two-stage room.
    expect(barrierPlanFor(50, 'WORLD_BOSS', () => 0.5)!.shape).toBe('airlock');
  });

  /** A slot has to be exactly one contiguous opening, or it is not a puzzle. */
  it('leaves exactly one contiguous slot in a straight wall', () => {
    const level = generateCampaignLevel(10);
    const shape = (level.metadata.barrier as { shape: string }).shape;
    if (shape !== 'gate' && shape !== 'vault') return;

    const taken = level.blocks
      .filter((block) => block.kind === 'DEFLECTOR')
      .map((block) => COLUMN_OF(block.x));
    const missing = [0, 1, 2, 3, 4, 5, 6, 7].filter((column) => !taken.includes(column));

    expect(missing.length).toBeGreaterThan(0);
    // Contiguous: every step between the open columns is exactly one.
    for (let i = 1; i < missing.length; i += 1) {
      expect(missing[i]! - missing[i - 1]!).toBe(1);
    }
  });

  /**
   * The slot narrows as the campaign goes on. This is the difficulty curve the
   * gates provide: the same shape gets progressively meaner without the player
   * having to learn anything new.
   */
  it('narrows the slot as the worlds go on', () => {
    // Worlds are 50 levels: 1–3 get three columns, 4–7 two, 8–10 one.
    const early = barrierPlanFor(10, 'MINI_BOSS', () => 0.05)!;
    const mid = barrierPlanFor(200, 'MINI_BOSS', () => 0.05)!;
    const late = barrierPlanFor(490, 'MINI_BOSS', () => 0.05)!;

    expect(early.gapWidth).toBe(3);
    expect(mid.gapWidth).toBe(2);
    expect(late.gapWidth).toBe(1);
  });

  it('puts a vault slot hard against a rail, so the only way in is a bank', () => {
    const plan = barrierPlanFor(130, 'MINI_BOSS', () => 0.85)!;
    expect(plan.shape).toBe('vault');
    expect([0, 8 - plan.gapWidth]).toContain(plan.gapColumn);
    // A vault must never slide: carrying its slot away from the rail would stop
    // it being a vault.
    expect(plan.slide).toBe(false);
  });

  it('builds the funnel as a chevron pointing at a central slot', () => {
    let plan = null;
    let level = null;
    for (let index = 1; index <= 200 && !plan; index += 1) {
      const candidate = generateCampaignLevel(index);
      const meta = candidate.metadata.barrier as { shape: string } | null;
      if (meta?.shape === 'funnel') {
        plan = meta;
        level = candidate;
      }
    }
    expect(plan, 'no funnel level found').not.toBeNull();

    const barriers = level!.blocks.filter((block) => block.kind === 'DEFLECTOR');
    const byColumn = new Map(barriers.map((block) => [COLUMN_OF(block.x), block.y]));
    const open = [0, 1, 2, 3, 4, 5, 6, 7].filter((column) => !byColumn.has(column));

    // Roughly central, and the arms rise away from it on both sides.
    expect(Math.min(...open)).toBeGreaterThan(0);
    expect(Math.max(...open)).toBeLessThan(7);
    expect(byColumn.get(0)!).toBeGreaterThan(byColumn.get(Math.min(...open) - 1)!);
    expect(byColumn.get(7)!).toBeGreaterThan(byColumn.get(Math.max(...open) + 1)!);
  });

  it('leaves threadable lanes between pillars', () => {
    let level = null;
    for (let index = 1; index <= 200 && !level; index += 1) {
      const candidate = generateCampaignLevel(index);
      const meta = candidate.metadata.barrier as { shape: string } | null;
      if (meta?.shape === 'pillars') level = candidate;
    }
    expect(level, 'no pillars level found').not.toBeNull();

    const bars = level!.blocks
      .filter((block) => block.kind === 'DEFLECTOR')
      .sort((a, b) => a.x - b.x);
    expect(bars.length).toBe(4);

    // Every lane has to be wider than the ball, or the wall is solid.
    for (let i = 1; i < bars.length; i += 1) {
      const lane = bars[i]!.x - bars[i - 1]!.x - bars[i]!.width;
      expect(lane, `lane ${i} is too narrow`).toBeGreaterThan(0.03);
    }
    // Tall bars, so a lane is a corridor rather than a doorstep.
    expect(bars[0]!.height).toBeGreaterThan(0.1);
  });

  it('keeps every brick clear of the barrier, arms and pillars included', () => {
    // A funnel climbs and a pillar is tall, so clearance measured from the
    // barrier's row rather than its ceiling would build the bottom brick rows
    // straight through them.
    for (let index = 10; index <= 160; index += 10) {
      const level = generateCampaignLevel(index);
      const barriers = level.blocks.filter((block) => block.kind === 'DEFLECTOR');
      if (!barriers.length) continue;
      const wallTop = Math.max(...barriers.map((block) => block.y + block.height / 2));
      const bricks = level.blocks.filter((block) => block.kind !== 'DEFLECTOR');
      const lowestBrick = Math.min(...bricks.map((block) => block.y - block.height / 2));
      expect(lowestBrick, `level ${index} builds bricks into its wall`).toBeGreaterThan(wallTop);
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
