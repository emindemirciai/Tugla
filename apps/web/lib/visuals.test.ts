import { bonusKinds } from '@tugla/shared';
import { describe, expect, it } from 'vitest';
import { brickShadeAt, createBlockGeometry, BRICK_SHADING } from './block-visuals';
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
    expect(depthStep(9)).toBe(depthStep(0));
    expect(depthStep(-1)).toBe(2);

    for (const family of BRICK_FAMILIES) {
      expect(new Set(family).size).toBe(3);
    }
  });

  /**
   * The gradient the design asked for cannot come from scene lighting: the
   * brick's front face points at the camera, so one directional light lands on
   * every brick at the same angle and the face renders flat. It has to be baked
   * into the geometry as vertex colours — which is exactly what made the 3D
   * bricks look nothing like the mockup before. These assertions are the design
   * contract: light from above, dark at the seat, and the top bevel brightest.
   */
  it('bakes the design gradient into the brick, lit from above', () => {
    const faceTop = brickShadeAt(0.5, 0, 0, 1);
    const faceMid = brickShadeAt(0.04, 0, 0, 1);
    const faceBottom = brickShadeAt(-0.5, 0, 0, 1);

    expect(faceTop).toBeGreaterThan(faceMid);
    expect(faceMid).toBeGreaterThan(faceBottom);
    expect(faceMid).toBeCloseTo(BRICK_SHADING.faceMid, 5);

    // The lit top edge is the brightest thing on the brick; the seated shadow
    // underneath is darker than the side walls.
    expect(brickShadeAt(0.5, 0, 1, 0)).toBeGreaterThan(faceTop);
    expect(brickShadeAt(-0.5, 0, -1, 0)).toBeLessThan(brickShadeAt(0, 1, 0, 0));

    // And the whole ramp stays near unity. A brick is a lit surface, not a
    // lamp: a peak far above 1 clips to white once emissive is added, which is
    // exactly how the wall turned into washed-out pastel with no gradient.
    for (const value of Object.values(BRICK_SHADING)) {
      expect(value).toBeLessThanOrEqual(1.35);
    }
  });

  it('carries one baked shade per brick vertex without distorting the footprint', () => {
    const geometry = createBlockGeometry();
    const position = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;

    expect(color).toBeDefined();
    expect(color.count).toBe(position.count);
    // Unit footprint, so the instance matrix can scale it straight onto the
    // block's collision box. The bevel is allowed to round the outline slightly.
    expect(box.max.x - box.min.x).toBeCloseTo(1, 1);
    expect(box.max.y - box.min.y).toBeCloseTo(1, 1);
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
    expect(formatElapsed(3480)).toBe('00:00:29');
    expect(formatElapsed(14400)).toBe('00:02:00');
    expect(formatElapsed(435000)).toBe('01:00:25');
  });
});
