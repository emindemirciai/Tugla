import { describe, expect, it } from 'vitest';
import { createDemoLevel, PulseEngine } from './index';

describe('PulseEngine', () => {
  it('starts with five lives and one attached ball', () => {
    const engine = new PulseEngine(createDemoLevel());
    expect(engine.snapshot.lives).toBe(5);
    expect(engine.snapshot.balls).toHaveLength(1);
    expect(engine.snapshot.status).toBe('READY');
  });

  it('caps multiball and converts overflow to damage', () => {
    const engine = new PulseEngine(createDemoLevel(), { maxBalls: 3 });
    engine.launch();
    expect(engine.addBalls(10)).toBe(2);
    expect(engine.snapshot.balls).toHaveLength(3);
    expect(engine.snapshot.balls[0]?.damage).toBeGreaterThan(1);
  });

  it('uses paddle movement for the first launch direction', () => {
    const engine = new PulseEngine(createDemoLevel());
    engine.setPaddleTarget(engine.width);
    engine.update(1 / 30);
    engine.launch();
    expect(engine.snapshot.balls[0]?.velocity.x).toBeGreaterThan(0);
  });
});
