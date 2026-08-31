import { bonusKinds } from '@tugla/shared';
import { describe, expect, it } from 'vitest';
import { brickShadeAt, createBlockGeometry, RADIUS_FRACTION } from './block-visuals';
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
   * Exact equality is not enough.
   *
   * The wall's dominant family was changed from warm to cyan (orange turns to
   * mud when under-lit, which is what the board actually looked like). That put
   * three meaning colours — ICE, PORTAL and DEFLECTOR — within a few percent of
   * an ordinary brick tone: distinct integers, indistinguishable on screen, and
   * the old test passed happily. DEFLECTOR is the dangerous one: mistaking an
   * unbreakable gate for a brick makes a level look broken.
   *
   * 45 in RGB space is roughly the point where two bricks read as the same
   * material at phone size.
   */
  it('keeps every meaning colour perceptually clear of the wall', () => {
    const rgb = (hex: number) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
    const distance = (a: number, b: number) => {
      const [ar, ag, ab] = rgb(a);
      const [br, bg, bb] = rgb(b);
      return Math.hypot(ar! - br!, ag! - bg!, ab! - bb!);
    };

    const tones = BRICK_FAMILIES.flatMap((family) => [...family]);
    for (const [kind, colour] of Object.entries(BLOCK_COLORS)) {
      if (kind === 'NORMAL') continue;
      const nearest = Math.min(...tones.map((tone) => distance(colour, tone)));
      expect(nearest, `${kind} is too close to an ordinary brick tone`).toBeGreaterThan(45);
    }

    // ARMORED is breakable and DEFLECTOR is not: confusing them is worse than
    // confusing either with a plain brick.
    expect(distance(BLOCK_COLORS.ARMORED!, BLOCK_COLORS.DEFLECTOR!)).toBeGreaterThan(60);
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
    // Perceived brightness of a linear RGB multiplier triple, after the gamma
    // encoding the display applies.
    const shown = (shade: readonly [number, number, number]) =>
      0.2126 * shade[0] ** (1 / 2.2) +
      0.7152 * shade[1] ** (1 / 2.2) +
      0.0722 * shade[2] ** (1 / 2.2);

    const faceTop = brickShadeAt(0.5, 0, 0, 1);
    const faceMid = brickShadeAt(0.04, 0, 0, 1);
    const faceBottom = brickShadeAt(-0.5, 0, 0, 1);

    expect(shown(faceTop)).toBeGreaterThan(shown(faceMid));
    expect(shown(faceMid)).toBeGreaterThan(shown(faceBottom));
    // The knee at 46% is the gradient's middle stop, which the instance colour
    // already holds — so it must be exactly neutral.
    expect(faceMid).toEqual([1, 1, 1]);

    // The lit top edge is the brightest thing on the brick; the seated shadow
    // underneath is darker than the side walls.
    expect(shown(brickShadeAt(0.5, 0, 1, 0))).toBeGreaterThan(shown(faceTop));
    expect(shown(brickShadeAt(-0.5, 0, -1, 0))).toBeLessThan(shown(brickShadeAt(0, 1, 0, 0)));

    // The gradient has to survive gamma encoding. Authored in linear light but
    // displayed in sRGB, a ratio of r arrives as r^(1/2.2) — which is how five
    // earlier attempts ended up with a barely-visible gradient. The design's
    // top-to-bottom luminance ratio is 1.53:1; require at least 1.4:1.
    expect(shown(faceTop) / shown(faceBottom)).toBeGreaterThan(1.4);

    // And it has to DESATURATE upward, the way the design's does: red climbs
    // far more than blue from the middle stop to the top. A ramp that moves all
    // three channels together lands the middle exactly and leaves the top too
    // saturated — measured rgb(123,224,254) against the design's
    // rgb(165,228,255).
    expect(faceTop[0]).toBeGreaterThan(faceTop[2] * 1.5);
    expect(faceBottom[0]).toBeLessThan(faceBottom[2] * 0.75);
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

  /**
   * The front cap is triangulated from OUTLINE vertices only — ExtrudeGeometry
   * adds no interior points — so a bare rounded rectangle gives triangles that
   * span the brick's whole height and the ramp's knee is interpolated away.
   * Measured, the centre of the face drifted to rgb(122,200,236) where the ramp
   * asks for rgb(109,200,241). The vertical edges are subdivided to fix it.
   */
  it('subdivides the brick outline so the baked ramp survives interpolation', () => {
    const geometry = createBlockGeometry({ bevel: false });
    const position = geometry.getAttribute('position');

    const heights = new Set<number>();
    for (let index = 0; index < position.count; index += 1) {
      // Front cap only.
      if (position.getZ(index) < 0) continue;
      heights.add(Number(position.getY(index).toFixed(3)));
    }

    expect(heights.size).toBeGreaterThan(8);
    // Including at least one vertex near the ramp's 46% knee (y = 0.04).
    const nearKnee = [...heights].some((y) => Math.abs(y - 0.04) < 0.08);
    expect(nearKnee).toBe(true);
    geometry.dispose();
  });

  /**
   * The corner radius is authored on the UNIT shape and the brick is then scaled
   * non-uniformly (1.65 : 1), so a single radius ALWAYS comes out as an ellipse.
   * Both earlier attempts got this wrong in opposite directions — 0.22 gave a
   * lozenge, 0.05 gave a corner too small to see — so the geometry now takes a
   * separate radius per axis, derived from the aspect ratio.
   */
  it('rounds the brick corner circularly once it has been scaled', () => {
    const aspect = 1.653;
    const geometry = createBlockGeometry({ aspect, bevel: false });
    const position = geometry.getAttribute('position');

    // Widest and tallest extents of the outline, in unit space.
    let maxX = 0;
    let maxY = 0;
    for (let index = 0; index < position.count; index += 1) {
      maxX = Math.max(maxX, Math.abs(position.getX(index)));
      maxY = Math.max(maxY, Math.abs(position.getY(index)));
    }

    // Find where the top edge stops being straight: that is the radius.
    let straightHalfWidth = 0;
    for (let index = 0; index < position.count; index += 1) {
      if (Math.abs(position.getY(index) - maxY) < 1e-6) {
        straightHalfWidth = Math.max(straightHalfWidth, Math.abs(position.getX(index)));
      }
    }
    const radiusX = maxX - straightHalfWidth;

    // Scaled to the real brick, the horizontal radius must match the vertical
    // one. Under a single unit radius this ratio would be the aspect itself.
    expect((radiusX * aspect) / RADIUS_FRACTION).toBeCloseTo(1, 1);
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
