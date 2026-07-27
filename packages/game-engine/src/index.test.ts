import { describe, expect, it } from 'vitest';
import { APP_DEFAULTS, decodeReplay, sessionChecksum } from '@pulse/shared';
import { createDemoLevel, generateCampaignLevel, PulseEngine, runReplay } from './index';
import type { LevelDefinition } from '@pulse/shared';

const simpleLevel = (
  overrides: Partial<LevelDefinition['blocks'][number]> = {},
): LevelDefinition => ({
  version: 1,
  name: 'Test',
  type: 'NORMAL',
  world: 1,
  index: 1,
  theme: 'neon-grid',
  seed: 1234,
  metadata: {},
  blocks: [
    {
      id: 'b1',
      kind: 'NORMAL',
      x: 0.5,
      y: 0.6,
      width: 0.2,
      height: 0.05,
      hitPoints: 1,
      rotation: 0,
      bonus: null,
      required: true,
      ...overrides,
    },
  ],
});

describe('PulseEngine basics', () => {
  it('starts with five lives and one attached ball', () => {
    const engine = new PulseEngine(createDemoLevel());
    expect(engine.snapshot.lives).toBe(APP_DEFAULTS.livesPerLevel);
    expect(engine.snapshot.balls).toHaveLength(1);
    expect(engine.snapshot.status).toBe('READY');
  });

  it('uses paddle movement to aim the first launch', () => {
    const engine = new PulseEngine(createDemoLevel());
    engine.setPaddleTarget(engine.width);
    engine.update(1 / 30);
    engine.launch();
    expect(engine.snapshot.balls[0]?.velocity.x).toBeGreaterThan(0);
    expect(engine.snapshot.balls[0]?.velocity.y).toBeGreaterThan(0);
  });

  it('deflects toward the edge the ball lands on', () => {
    const engine = new PulseEngine(simpleLevel());
    engine.launch();
    const ball = engine.snapshot.balls[0]!;
    ball.position.x = engine.snapshot.paddle.x + engine.snapshot.paddle.width / 2 - 0.01;
    ball.position.y = engine.snapshot.paddle.y + 0.1;
    ball.velocity.x = 0;
    ball.velocity.y = -6;
    engine.step();
    expect(ball.velocity.x).toBeGreaterThan(0);
  });
});

describe('multiball and Overcharge', () => {
  it('caps active balls and converts the surplus into Overcharge damage', () => {
    const engine = new PulseEngine(createDemoLevel(), { maxBalls: 3 });
    engine.launch();
    expect(engine.addBalls(10)).toBe(2);
    expect(engine.snapshot.balls).toHaveLength(3);
    expect(engine.snapshot.overcharge).toBeGreaterThan(1);
  });

  it('never exceeds the configured 500 ball cap', () => {
    const engine = new PulseEngine(createDemoLevel(), { maxBalls: APP_DEFAULTS.maxBalls });
    engine.launch();
    for (let index = 0; index < 40; index += 1) engine.addBalls(50);
    expect(engine.snapshot.balls.length).toBeLessThanOrEqual(APP_DEFAULTS.maxBalls);
    expect(engine.snapshot.overcharge).toBeGreaterThan(1);
    expect(engine.snapshot.overcharge).toBeLessThanOrEqual(8);
  });

  it('emits an OVERCHARGE event when the cap is exceeded', () => {
    const engine = new PulseEngine(createDemoLevel(), { maxBalls: 2 });
    engine.launch();
    engine.drainEvents();
    engine.addBalls(20);
    expect(engine.drainEvents().some((event) => event.type === 'OVERCHARGE')).toBe(true);
  });
});

describe('block behaviours', () => {
  it('destroys a normal block and counts it', () => {
    const engine = new PulseEngine(simpleLevel());
    engine.launch();
    const ball = engine.snapshot.balls[0]!;
    ball.position.x = engine.snapshot.blocks[0]!.position.x;
    ball.position.y = engine.snapshot.blocks[0]!.position.y - 0.1;
    engine.step();
    expect(engine.snapshot.blocksDestroyed).toBe(1);
  });

  it('regenerates a REGENERATING block after its cooldown', () => {
    const engine = new PulseEngine(
      simpleLevel({ kind: 'REGENERATING', hitPoints: 1, required: false }),
    );
    engine.launch();
    const block = engine.snapshot.blocks[0]!;
    const ball = engine.snapshot.balls[0]!;
    ball.position.x = block.position.x;
    ball.position.y = block.position.y - 0.1;
    engine.step();
    expect(block.active).toBe(false);
    for (let index = 0; index < 1000; index += 1) engine.step();
    expect(engine.snapshot.blocks[0]!.active).toBe(true);
  });

  it('absorbs the first hit on a SHIELDED block', () => {
    const engine = new PulseEngine(simpleLevel({ kind: 'SHIELDED', hitPoints: 1 }));
    engine.launch();
    const block = engine.snapshot.blocks[0]!;
    const ball = engine.snapshot.balls[0]!;
    ball.position.x = block.position.x;
    ball.position.y = block.position.y - 0.1;
    engine.step();
    expect(block.active).toBe(true);
    expect(engine.snapshot.blocksDestroyed).toBe(0);
  });

  it('marks the boss defeated when a BOSS_CORE is destroyed', () => {
    const engine = new PulseEngine(simpleLevel({ kind: 'BOSS_CORE', hitPoints: 1 }));
    engine.launch();
    const block = engine.snapshot.blocks[0]!;
    const ball = engine.snapshot.balls[0]!;
    ball.position.x = block.position.x;
    ball.position.y = block.position.y - 0.1;
    engine.step();
    expect(engine.snapshot.bossDefeated).toBe(true);
  });
});

describe('lives and completion', () => {
  it('loses a life when the last ball drops and resets to READY', () => {
    const engine = new PulseEngine(simpleLevel());
    engine.launch();
    const ball = engine.snapshot.balls[0]!;
    ball.position.y = -2;
    ball.velocity.y = -6;
    engine.step();
    expect(engine.snapshot.lives).toBe(APP_DEFAULTS.livesPerLevel - 1);
    expect(engine.snapshot.status).toBe('READY');
  });

  it('fails the level after five lost lives', () => {
    const engine = new PulseEngine(simpleLevel());
    for (let life = 0; life < APP_DEFAULTS.livesPerLevel; life += 1) {
      engine.launch();
      const ball = engine.snapshot.balls[0]!;
      ball.position.y = -2;
      ball.velocity.y = -6;
      engine.step();
    }
    expect(engine.snapshot.status).toBe('FAILED');
    expect(engine.snapshot.lives).toBe(0);
  });

  it('completes the level once every required block is cleared', () => {
    const engine = new PulseEngine(simpleLevel());
    engine.launch();
    const block = engine.snapshot.blocks[0]!;
    const ball = engine.snapshot.balls[0]!;
    ball.position.x = block.position.x;
    ball.position.y = block.position.y - 0.1;
    engine.step();
    expect(engine.snapshot.status).toBe('COMPLETED');
  });
});

describe('determinism and replay', () => {
  const play = (seed: number) => {
    const engine = new PulseEngine(generateCampaignLevel(3), { seed, recordReplay: true });
    engine.setPaddleTarget(5.2);
    engine.launch();
    for (let tick = 0; tick < 2400; tick += 1) {
      if (tick % 240 === 0) engine.setPaddleTarget(2 + (tick % 5));
      engine.step();
    }
    return engine;
  };

  it('produces identical results for identical seeds and inputs', () => {
    const a = play(99);
    const b = play(99);
    expect(a.snapshot.score).toBe(b.snapshot.score);
    expect(a.snapshot.tick).toBe(b.snapshot.tick);
    expect(a.snapshot.blocksDestroyed).toBe(b.snapshot.blocksDestroyed);
  });

  it('reproduces the original score when the replay is re-simulated', () => {
    const level = generateCampaignLevel(4);
    const engine = new PulseEngine(level, { seed: 4242, recordReplay: true });
    engine.setPaddleTarget(4.4);
    engine.launch();
    for (let tick = 0; tick < 3000; tick += 1) {
      if (tick % 300 === 0) engine.setPaddleTarget(3 + (tick % 4));
      engine.step();
      if (engine.snapshot.status === 'COMPLETED' || engine.snapshot.status === 'FAILED') break;
    }
    const document = decodeReplay(engine.encodeReplay());
    const replayed = runReplay(level, document);
    expect(replayed.score).toBe(engine.snapshot.score);
    expect(replayed.blocksDestroyed).toBe(engine.snapshot.blocksDestroyed);
  });

  it('builds a result whose checksum matches the shared implementation', () => {
    const engine = new PulseEngine(createDemoLevel(), { seed: 7 });
    engine.launch();
    for (let tick = 0; tick < 600; tick += 1) engine.step();
    const session = { sessionId: '11111111-2222-4333-8444-555555555555', nonce: 'test-nonce' };
    const result = engine.buildResult(session);
    expect(result.checksum).toBe(
      sessionChecksum({
        sessionId: session.sessionId,
        nonce: session.nonce,
        seed: 7,
        score: result.score,
        durationMs: result.durationMs,
        blocksDestroyed: result.blocksDestroyed,
        eventCount: result.eventCount,
        finalTick: result.finalTick,
        livesRemaining: result.livesRemaining,
        maxBalls: result.maxBalls,
      }),
    );
  });
});

describe('campaign generation', () => {
  it('generates 500 valid levels across 10 worlds with the right boss cadence', () => {
    const worlds = new Set<number>();
    let miniBosses = 0;
    let worldBosses = 0;
    for (let index = 1; index <= APP_DEFAULTS.worlds * APP_DEFAULTS.levelsPerWorld; index += 1) {
      const level = generateCampaignLevel(index);
      worlds.add(level.world);
      expect(level.blocks.length).toBeGreaterThan(0);
      expect(level.blocks.length).toBeLessThanOrEqual(500);
      if (level.type === 'MINI_BOSS') miniBosses += 1;
      if (level.type === 'WORLD_BOSS') worldBosses += 1;
    }
    expect(worlds.size).toBe(APP_DEFAULTS.worlds);
    expect(worldBosses).toBe(10);
    expect(miniBosses).toBe(40);
  });

  it('is stable: the same index always generates the same level', () => {
    expect(generateCampaignLevel(37)).toEqual(generateCampaignLevel(37));
  });
});
