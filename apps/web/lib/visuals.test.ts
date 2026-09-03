import { bonusKinds } from '@tugla/shared';
import { describe, expect, it } from 'vitest';
import { brickShadeAt, createBlockGeometry, BRICK_SHADING } from './block-visuals';
import {
  faceKeyFor,
  faceSpecFor,
  wallFaceIndex,
  KIND_FACES,
  WALL_FACES,
  RADIUS_FRACTION,
} from './brick-textures';
import { bonusColor } from './bonus-visuals';

describe('brick faces', () => {
  /**
   * The design's headline is that block kinds differ by MATERIAL, not colour:
   * rivets and a crack on TOUGH, ribbed plate on ARMORED, a lit ring on
   * SHIELDED, an ember core in FIRE. For six rounds the game shipped the colour
   * half only, so every brick was a plain slab and the board read as coloured
   * rectangles however well they were shaded. This is the test that says the
   * material half has to exist.
   */
  it('identifies every hard-to-read kind by surface detail, not colour alone', () => {
    const mustHaveDetail = [
      'TOUGH',
      'ARMORED',
      'EXPLOSIVE',
      'FIRE',
      'SHIELDED',
      'DEFLECTOR',
      'ABSORBER',
    ];
    for (const kind of mustHaveDetail) {
      const spec = KIND_FACES[kind];
      expect(spec, `${kind} has no face spec`).toBeDefined();
      expect(spec!.details?.length, `${kind} is distinguished by colour alone`).toBeGreaterThan(0);
    }

    // The unbreakable barrier must not be mistaken for ARMORED, which IS
    // breakable: same family of detail, deliberately darker and flatter.
    expect(KIND_FACES.DEFLECTOR!.details).toContain('ribs');
    expect(KIND_FACES.DEFLECTOR!.stops[1]).not.toBe(KIND_FACES.ARMORED!.stops[1]);
  });

  /** Ordinary bricks: two families, three depth bands, stable per position. */
  it('spreads the wall over six variants by family and row band', () => {
    expect(WALL_FACES).toHaveLength(6);

    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((row) => wallFaceIndex(0, row) % 3)).toEqual([
      0, 0, 0, 1, 1, 1, 2, 2, 2,
    ]);
    // The BAND wraps every nine rows; the family deliberately does not. Family
    // comes from `(column * 3 + row) % 10`, which keeps the 70/30 scatter from
    // repeating as a visible stripe every nine rows — so row 9 shares row 0's
    // depth step while sitting in the other colour family.
    expect(wallFaceIndex(0, 9) % 3).toBe(wallFaceIndex(0, 0) % 3);
    expect(Math.floor(wallFaceIndex(0, 9) / 3)).not.toBe(Math.floor(wallFaceIndex(0, 0) / 3));

    // Deterministic: the same authored position always paints the same way, so
    // a moving block keeps its face instead of flickering.
    expect(wallFaceIndex(3, 4)).toBe(wallFaceIndex(3, 4));
  });

  it('sends bricks with a fixed meaning to their kind face, everything else to the wall', () => {
    expect(faceKeyFor('NORMAL', 2, 3)).toBe(`w:${wallFaceIndex(2, 3)}`);
    expect(faceKeyFor('EXPLOSIVE', 2, 3)).toBe('k:EXPLOSIVE');

    // The bug that made the board brown for three rounds: kinds with no entry
    // in the meaning table used to fall through to the world's own block colour
    // (a mid orange for solar-forge), which the shading ramp then drove to dark
    // brown. Anything without a face spec belongs to the wall.
    expect(faceKeyFor('PADDLE_NONSENSE', 1, 1).startsWith('w:')).toBe(true);
  });

  it('resolves every face key to a paintable spec', () => {
    for (const kind of Object.keys(KIND_FACES)) {
      const spec = faceSpecFor(`k:${kind}`);
      expect(spec.stops).toHaveLength(3);
      for (const stop of spec.stops) expect(stop).toMatch(/^#[0-9a-f]{6}$/i);
    }
    for (let index = 0; index < WALL_FACES.length; index += 1) {
      expect(faceSpecFor(`w:${index}`).stops).toHaveLength(3);
    }
  });

  /** Each gradient has to actually descend, or the brick has no light direction. */
  it('darkens every face gradient from top to bottom', () => {
    const lum = (hex: string) => {
      const value = Number.parseInt(hex.slice(1), 16);
      return (
        0.2126 * ((value >> 16) & 255) + 0.7152 * ((value >> 8) & 255) + 0.0722 * (value & 255)
      );
    };
    for (const [name, spec] of [
      ...Object.entries(KIND_FACES),
      ...WALL_FACES.map((spec, index) => [`wall ${index}`, spec] as const),
    ]) {
      expect(lum(spec.stops[0]), `${name} top`).toBeGreaterThan(lum(spec.stops[1]));
      expect(lum(spec.stops[1]), `${name} middle`).toBeGreaterThan(lum(spec.stops[2]));
    }
  });
});

describe('brick geometry', () => {
  it('keeps the unit footprint so the drawn brick is its collision box', () => {
    const geometry = createBlockGeometry();
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    // The bevel is allowed to round the outline slightly.
    expect(box.max.x - box.min.x).toBeCloseTo(1, 1);
    expect(box.max.y - box.min.y).toBeCloseTo(1, 1);
    geometry.dispose();
  });

  /**
   * ExtrudeGeometry's UV generator emits raw shape coordinates, which for a unit
   * shape centred on the origin is -0.5..0.5. Left alone, the face texture would
   * be sampled outside its bounds and the brick would come out clamped to one
   * edge pixel.
   */
  it('remaps the front face to 0..1 and parks every other surface on one pixel', () => {
    const geometry = createBlockGeometry({ bevel: false });
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');

    let faceVerts = 0;
    for (let index = 0; index < uv.count; index += 1) {
      const u = uv.getX(index);
      const v = uv.getY(index);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);

      if (normal.getZ(index) > 0.9) faceVerts += 1;
      else {
        // Sides and the back sample one interior pixel rather than smearing the
        // face's detail around the edges.
        expect(u).toBeCloseTo(0.5, 5);
        expect(v).toBeCloseTo(0.5, 5);
      }
    }
    expect(faceVerts).toBeGreaterThan(3);
    geometry.dispose();
  });

  /**
   * The corner radius is authored on the unit shape and the brick is then scaled
   * non-uniformly (1.65 : 1), so a single radius always comes out as an ellipse.
   * 0.22 gave a lozenge; 0.05 gave a corner too small to see.
   */
  it('rounds the corner circularly once the brick has been scaled', () => {
    const aspect = 1.653;
    const geometry = createBlockGeometry({ aspect, bevel: false });
    const position = geometry.getAttribute('position');

    let maxX = 0;
    let maxY = 0;
    for (let index = 0; index < position.count; index += 1) {
      maxX = Math.max(maxX, Math.abs(position.getX(index)));
      maxY = Math.max(maxY, Math.abs(position.getY(index)));
    }
    let straightHalfWidth = 0;
    for (let index = 0; index < position.count; index += 1) {
      if (Math.abs(position.getY(index) - maxY) < 1e-6) {
        straightHalfWidth = Math.max(straightHalfWidth, Math.abs(position.getX(index)));
      }
    }

    expect(((maxX - straightHalfWidth) * aspect) / RADIUS_FRACTION).toBeCloseTo(1, 1);
    geometry.dispose();
  });

  /**
   * The face is neutral because its texture carries the shading. The remaining
   * vertex shades exist to darken the surfaces the texture does not describe, so
   * the slab still reads as three-dimensional.
   */
  it('leaves the face neutral and shades the other surfaces by normal', () => {
    expect(brickShadeAt(0, 0, 1)).toBe(1);
    expect(BRICK_SHADING.face).toBe(1);

    // Light from above: the top bevel is hot, the seat underneath is the
    // darkest thing on the brick, the walls sit between them.
    expect(brickShadeAt(0, 1, 0)).toBeGreaterThan(1);
    expect(brickShadeAt(0, -1, 0)).toBeLessThan(brickShadeAt(1, 0, 0));
    expect(brickShadeAt(1, 0, 0)).toBeLessThan(1);
    expect(brickShadeAt(0, 0, -1)).toBeLessThan(brickShadeAt(1, 0, 0));
  });
});

describe('other visuals', () => {
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
