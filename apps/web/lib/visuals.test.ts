import { bonusKinds } from '@tugla/shared';
import { describe, expect, it } from 'vitest';
import { createBlockGeometry } from './block-visuals';
import { bonusColor } from './bonus-visuals';
import { BLOCK_COLORS, BRICK_FAMILIES, depthStep } from '../components/GameRenderer';

describe('web visual language', () => {
  /**
   * Guards the defect the brick redesign fixed.
   *
   * The old seven-tone pool overlapped the meaning colours: TOUGH was
   * byte-identical to tone 1 and EXPLOSIVE was indistinguishable from tone 6, so
   * a player could not tell a plain brick from one that takes two hits or blows
   * up its neighbours. Any future tone added to a family has to stay clear of
   * every special kind, and this test is what says so.
   */
  it('keeps ordinary brick tones clear of every special block colour', () => {
    const tones = BRICK_FAMILIES.flatMap((family) => [...family]);
    const meanings = Object.entries(BLOCK_COLORS).filter(([kind]) => kind !== 'NORMAL');

    expect(tones).toHaveLength(6);
    expect(new Set(tones).size).toBe(tones.length);

    for (const [kind, colour] of meanings) {
      expect(tones, `${kind} collides with an ordinary brick tone`).not.toContain(colour);
    }
  });

  /**
   * The wall reads as a lit relief because deeper rows sit darker. Each family
   * must therefore cover all three steps across a nine-row band, and a moving
   * block must keep its step rather than flickering through the palette.
   */
  it('steps ordinary brick depth by row band', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(depthStep)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2]);
    // Stable across bands and for negative rows, so authored positions outside
    // the first band still resolve to a step.
    expect(depthStep(9)).toBe(depthStep(0));
    expect(depthStep(-1)).toBe(2);

    for (const family of BRICK_FAMILIES) {
      expect(new Set(family).size).toBe(3);
    }
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
