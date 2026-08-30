import * as THREE from 'three';

/**
 * The brick, as one shared geometry.
 *
 * ## Why the 3D bricks did not look like the design
 *
 * The design mockup painted every brick with CSS: a three-stop vertical
 * gradient, a 1px lit edge along the top, a seated shadow along the bottom. The
 * game draws all bricks as a single `InstancedMesh`, and an instanced mesh can
 * only give each brick ONE flat colour through `instanceColor`. Shading then
 * comes from the scene lights — but the brick's front face points straight at
 * the camera and the key light is far away, so a directional light lands on
 * every brick at almost exactly the same angle. Result: a flat, uniform
 * rectangle. No gradient, no lit top edge, no seated shadow. Rounding the
 * corners and calming the material (the previous pass) fixed the silhouette,
 * but nothing could recover the gradient, because there was nowhere for it to
 * live.
 *
 * ## The fix
 *
 * Bake the gradient into the geometry as VERTEX COLOURS. Three.js multiplies
 * `material.color × vertexColor × instanceColor`, so one geometry carrying the
 * design's luminance ramp is tinted per brick by that brick's own hue. Every
 * brick gets the top light edge, the downward ramp and the dark seat — from one
 * geometry, in one draw call, with no shader and no per-brick material.
 *
 * The ramp values below are the mockup's own stops, converted to luminance
 * multipliers: the CSS `linear-gradient(180deg, #a5e4ff, #6fcbf5 46%, #3f9fd0)`
 * is a 1.14 → 1.0 → 0.68 ramp over that hue, and `inset 0 1px 0
 * rgba(255,255,255,.5)` is the 1.3 top edge.
 *
 * These multiply the DIFFUSE term. They are deliberately close to 1.0: a brick
 * in the design is a lit surface, not a light source, and a ramp that peaks far
 * above 1 clips to white the moment any emissive is added on top of it.
 */

/** Luminance ramp, matching the design's gradient stops. */
export const BRICK_SHADING = {
  /** Bevel facing up — the lit top edge. */
  topEdge: 1.3,
  /** Front face at the top of the brick. */
  faceTop: 1.14,
  /** Front face at 46% down, the gradient's middle stop. */
  faceMid: 1.0,
  /** Front face at the bottom. */
  faceBottom: 0.68,
  /** Bevel facing down — the seated shadow. */
  bottomEdge: 0.42,
  /** Left and right walls. */
  side: 0.76,
  /** Rear faces, only ever seen at the board's edges. */
  back: 0.5,
} as const;

/** Depth of the extruded slab, in unit-brick space. */
const DEPTH = 0.42;

/**
 * Samples the ramp for one vertex.
 *
 * Exported because the ramp is the design contract: a test asserts that the top
 * of the brick is brighter than the bottom and that the top bevel is the
 * brightest thing on it, so a future tweak cannot silently flatten the wall
 * back out.
 */
export const brickShadeAt = (y: number, normalX: number, normalY: number, normalZ: number) => {
  // Bevels and walls first — they are the edges that carry the light direction.
  if (normalY > 0.35) return BRICK_SHADING.topEdge;
  if (normalY < -0.35) return BRICK_SHADING.bottomEdge;
  if (Math.abs(normalX) > 0.35) return BRICK_SHADING.side;
  if (normalZ < -0.35) return BRICK_SHADING.back;

  // Front face: the three-stop ramp, top (y = +0.5) to bottom (y = -0.5).
  const t = Math.min(1, Math.max(0, 0.5 - y));
  return t <= 0.46
    ? BRICK_SHADING.faceTop + (BRICK_SHADING.faceMid - BRICK_SHADING.faceTop) * (t / 0.46)
    : BRICK_SHADING.faceMid +
        (BRICK_SHADING.faceBottom - BRICK_SHADING.faceMid) * ((t - 0.46) / 0.54);
};

/**
 * The unit brick: a 1 × 1 rounded rectangle extruded to a slab, carrying the
 * design's luminance ramp in its `color` attribute.
 *
 * Built at unit size and scaled per instance to the block's real collision box,
 * so the drawn brick is exactly the box the ball bounces off.
 */
export const createBlockGeometry = (options: { bevel?: boolean } = {}) => {
  const bevel = options.bevel ?? true;

  // The radius applies to the UNIT shape, which is then scaled to the brick's
  // real footprint (0.845 × 0.511 board units). A large radius here becomes an
  // ellipse after scaling — which is what made every brick read as a lozenge.
  // 0.05 lands at roughly 2px on both axes: a crisp corner that still catches
  // the key light.
  const radius = 0.05;
  const half = 0.5 - radius;
  const shape = new THREE.Shape();
  shape.moveTo(-half, -0.5);
  shape.lineTo(half, -0.5);
  shape.quadraticCurveTo(0.5, -0.5, 0.5, -half);
  shape.lineTo(0.5, half);
  shape.quadraticCurveTo(0.5, 0.5, half, 0.5);
  shape.lineTo(-half, 0.5);
  shape.quadraticCurveTo(-0.5, 0.5, -0.5, half);
  shape.lineTo(-0.5, -half);
  shape.quadraticCurveTo(-0.5, -0.5, -half, -0.5);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: DEPTH,
    bevelEnabled: bevel,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 1,
    curveSegments: 3,
  });
  // Centre the slab on z = 0 so the instance matrix does not have to.
  geometry.translate(0, 0, -DEPTH / 2 - 0.05);
  geometry.computeVertexNormals();

  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const shade = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    const value = brickShadeAt(
      position.getY(index),
      normal.getX(index),
      normal.getY(index),
      normal.getZ(index),
    );
    shade[index * 3] = value;
    shade[index * 3 + 1] = value;
    shade[index * 3 + 2] = value;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(shade, 3));

  return geometry;
};
