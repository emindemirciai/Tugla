import { describe, expect, it } from 'vitest';
import { TuğlaEngine, generateCampaignLevel } from '@tugla/game-engine';
import { readActiveEffects } from '../components/GameCanvas';

/**
 * The HUD's effect readout.
 *
 * `readActiveEffects` is pure so this can assert what the panel shows without a
 * canvas, a WebGL context or a running rally — the reason the reader was split
 * out of the component in the first place.
 */
const engineAt = () => {
  const engine = new TuğlaEngine(generateCampaignLevel(1), { recordReplay: false });
  engine.launch({ record: false });
  return engine;
};

describe('HUD effect readout', () => {
  it('shows nothing on a clean board', () => {
    expect(readActiveEffects(engineAt().snapshot)).toHaveLength(0);
  });

  it('names every collected effect and counts it down', () => {
    const engine = engineAt();
    engine.collectBonus('PADDLE_GROW', { record: false });
    engine.collectBonus('LASER', { record: false });
    engine.collectBonus('SAFETY_NET', { record: false });

    const ids = readActiveEffects(engine.snapshot).map((effect) => effect.id);
    expect(ids).toContain('grow');
    expect(ids).toContain('laser');
    expect(ids).toContain('net');

    const grow = readActiveEffects(engine.snapshot).find((effect) => effect.id === 'grow')!;
    expect(grow.ticks).toBeGreaterThan(0);
    // Freshly collected, so the drain bar is full.
    expect(grow.fraction).toBeCloseTo(1, 2);

    for (let index = 0; index < 240; index += 1) engine.step();
    const later = readActiveEffects(engine.snapshot).find((effect) => effect.id === 'grow')!;
    expect(later.ticks).toBeLessThan(grow.ticks);
    expect(later.fraction!).toBeLessThan(1);
  });

  it('orders soonest-to-expire first', () => {
    const engine = engineAt();
    engine.collectBonus('PADDLE_GROW', { record: false });
    engine.collectBonus('SAFETY_NET', { record: false });

    const effects = readActiveEffects(engine.snapshot);
    // The net runs 600 ticks, the wider paddle 1800: the net is the one about to
    // run out, so it sits at the top.
    expect(effects[0]!.id).toBe('net');
  });

  it('shows the shield as a charge rather than a timer', () => {
    const engine = engineAt();
    engine.collectBonus('SHIELD', { record: false });
    const shield = readActiveEffects(engine.snapshot).find((effect) => effect.id === 'shield')!;
    expect(shield.fraction).toBeNull();
    expect(shield.ticks).toBe(0);
  });

  it('collapses a ball effect held by several balls into one chip', () => {
    const engine = engineAt();
    engine.collectBonus('BALL_3', { record: false });
    engine.collectBonus('FIREBALL', { record: false });

    const active = engine.snapshot.balls.filter((ball) => ball.active);
    expect(active.length).toBeGreaterThan(1);

    const fireballs = readActiveEffects(engine.snapshot).filter(
      (effect) => effect.id === 'FIREBALL',
    );
    expect(fireballs).toHaveLength(1);
  });
});
