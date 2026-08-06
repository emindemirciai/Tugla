import { bonusKinds } from '@tugla/shared';
import { describe, expect, it } from 'vitest';
import { createBlockGeometry } from './block-visuals';
import { bonusColor } from './bonus-visuals';
import { HERO_PREVIEW_BALLS, heroPreviewBallStyle } from './hero-preview';

describe('web visual language', () => {
  it('keeps every hero ball moving through a padded, non-central trajectory', () => {
    expect(HERO_PREVIEW_BALLS).toHaveLength(8);
    expect(new Set(HERO_PREVIEW_BALLS.map((ball) => ball.tone))).toEqual(
      new Set(['peach', 'aqua', 'violet']),
    );

    for (const ball of HERO_PREVIEW_BALLS) {
      expect(new Set(ball.points.map((point) => point.x)).size).toBeGreaterThan(1);
      expect(new Set(ball.points.map((point) => point.y)).size).toBeGreaterThan(1);
      for (const point of ball.points) {
        expect(point.x).toBeGreaterThanOrEqual(5);
        expect(point.x).toBeLessThanOrEqual(95);
        expect(point.y).toBeGreaterThanOrEqual(5);
        expect(point.y).toBeLessThanOrEqual(95);
        expect(point).not.toEqual({ x: 50, y: 50 });
      }
    }

    expect(heroPreviewBallStyle(HERO_PREVIEW_BALLS[0]!)).toMatchObject({
      '--x-0': '12%',
      '--y-0': '84%',
      '--ball-duration': '4.1s',
      '--ball-delay': '-1.2s',
    });
  });

  it('uses actual rounded block normals without changing the unit footprint', () => {
    const geometry = createBlockGeometry();
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const normal = geometry.getAttribute('normal');
    let roundedNormalFound = false;

    for (let index = 0; index < normal.count; index += 1) {
      const components = [
        Math.abs(normal.getX(index)),
        Math.abs(normal.getY(index)),
        Math.abs(normal.getZ(index)),
      ];
      if (components.filter((component) => component > 0.05).length > 1) {
        roundedNormalFound = true;
        break;
      }
    }

    expect(box.max.x - box.min.x).toBeCloseTo(1, 5);
    expect(box.max.y - box.min.y).toBeCloseTo(1, 5);
    expect(box.max.z - box.min.z).toBeCloseTo(0.46, 5);
    expect((box.max.z + box.min.z) / 2).toBeCloseTo(0.02, 5);
    expect(roundedNormalFound).toBe(true);
    geometry.dispose();
  });

  it('gives falling bonus families visibly distinct colours', () => {
    const colours = bonusKinds.map(bonusColor);
    expect(colours.every((colour) => Number.isInteger(colour))).toBe(true);
    expect(new Set(colours).size).toBe(bonusKinds.length);
    expect(bonusColor('BALL_1')).not.toBe(bonusColor('SAFETY_NET'));
    expect(bonusColor('FIREBALL')).not.toBe(bonusColor('SHIELD'));
  });

  it('formats elapsed tick duration strictly as HH:MM:SS', async () => {
    const { formatElapsed } = await import('../components/GameCanvas');
    expect(formatElapsed(0)).toBe('00:00:00');
    expect(formatElapsed(3480)).toBe('00:00:29'); // 29 seconds
    expect(formatElapsed(14400)).toBe('00:02:00'); // 120 seconds
    expect(formatElapsed(435000)).toBe('01:00:25'); // 1h 25s
  });
});
