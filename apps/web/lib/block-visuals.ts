import * as THREE from 'three';
import { RADIUS_FRACTION } from './brick-textures';

/**
 * The brick, as one shared geometry.
 *
 * ## What lives here, and what does not
 *
 * The FACE is a canvas texture (see brick-textures.ts) — that is where the
 * design's gradient and its per-kind detail live. This file supplies the slab
 * the texture sits on: a rounded rectangle extruded to give the brick real
 * edges, with UVs remapped so the texture lands square on the front, and a
 * vertex-colour attribute that darkens the sides, the seated bevel and the
 * back.
 *
 * Six rounds went into trying to make the FACE gradient work as vertex colours
 * on a lit material, and it could not: three.js multiplies vColor into the
 * diffuse term only, so the specular lobe is added on top untinted and unramped
 * — a near-constant sheet of white light on a face pointing at the camera, which
 * lifts the dark end of the gradient and compresses the whole ramp. Measured, a
 * ramp authored at 1.16 → 0.76 arrived as 0.739 → 0.652, a third of its
 * intended spread. Baking the face into an sRGB texture and using an unlit
 * material removes that entire class of problem: output is the texture, and the
 * texture is a transcription of the CSS.
 *
 * The vertex ramp that remains is only for surfaces the texture does not cover,
 * where a flat multiplier is exactly right.
 */

/** Depth of the extruded slab, in unit-brick space. */
const DEPTH = 0.42;

/** How much each non-face surface darkens. Multiplies the texture. */
export const BRICK_SHADING = {
  /** Front face — the texture carries the shading, so this is neutral. */
  face: 1,
  /** Bevel facing up. Slightly hot: it catches the key light. */
  topEdge: 1.15,
  /** Bevel facing down — the brick's seated shadow. */
  bottomEdge: 0.42,
  /** Left and right walls. */
  side: 0.62,
  /** Rear faces, only ever seen at the board's edges. */
  back: 0.4,
} as const;

/** Shade for one vertex, from its normal. */
export const brickShadeAt = (normalX: number, normalY: number, normalZ: number) => {
  if (normalZ > 0.9) return BRICK_SHADING.face;
  if (normalY > 0.35) return BRICK_SHADING.topEdge;
  if (normalY < -0.35) return BRICK_SHADING.bottomEdge;
  if (Math.abs(normalX) > 0.35) return BRICK_SHADING.side;
  if (normalZ < -0.35) return BRICK_SHADING.back;
  return BRICK_SHADING.side;
};

/**
 * The unit brick: a 1 × 1 rounded rectangle extruded to a slab.
 *
 * Built at unit size and scaled per instance to the block's real collision box,
 * so the drawn brick is exactly the box the ball bounces off. The corner radius
 * is authored per axis, because the brick is scaled non-uniformly (1.65 : 1) and
 * a single radius always comes out as an ellipse — 0.22 gave a lozenge, 0.05
 * gave a corner too small to see.
 */
export const createBlockGeometry = (options: { bevel?: boolean; aspect?: number } = {}) => {
  const bevel = options.bevel ?? true;
  const aspect = options.aspect && options.aspect > 0 ? options.aspect : 1.653;

  const radiusY = RADIUS_FRACTION;
  const radiusX = RADIUS_FRACTION / aspect;
  const halfX = 0.5 - radiusX;
  const halfY = 0.5 - radiusY;

  const shape = new THREE.Shape();
  shape.moveTo(-halfX, -0.5);
  shape.lineTo(halfX, -0.5);
  shape.quadraticCurveTo(0.5, -0.5, 0.5, -halfY);
  shape.lineTo(0.5, halfY);
  shape.quadraticCurveTo(0.5, 0.5, halfX, 0.5);
  shape.lineTo(-halfX, 0.5);
  shape.quadraticCurveTo(-0.5, 0.5, -0.5, halfY);
  shape.lineTo(-0.5, -halfY);
  shape.quadraticCurveTo(-0.5, -0.5, -halfX, -0.5);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: DEPTH,
    bevelEnabled: bevel,
    bevelThickness: 0.03,
    bevelSize: 0.02,
    bevelSegments: 1,
    curveSegments: 4,
  });
  // Centre the slab on z = 0 so the instance matrix does not have to.
  geometry.translate(0, 0, -DEPTH / 2 - 0.05);
  geometry.computeVertexNormals();

  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  const shade = new Float32Array(position.count * 3);

  for (let index = 0; index < position.count; index += 1) {
    const nx = normal.getX(index);
    const ny = normal.getY(index);
    const nz = normal.getZ(index);

    const value = brickShadeAt(nx, ny, nz);
    shade[index * 3] = value;
    shade[index * 3 + 1] = value;
    shade[index * 3 + 2] = value;

    if (nz > 0.9) {
      // ExtrudeGeometry's default UV generator emits the raw shape coordinates,
      // which for a unit shape centred on the origin is -0.5..0.5. Remap to
      // 0..1 so the face texture lands square on the brick.
      uv.setXY(index, position.getX(index) + 0.5, position.getY(index) + 0.5);
    } else {
      // Sides, bevels and the back sample one interior pixel rather than
      // smearing the face's detail around the edges; the vertex shade above is
      // what actually darkens them.
      uv.setXY(index, 0.5, 0.5);
    }
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(shade, 3));
  uv.needsUpdate = true;

  return geometry;
};
