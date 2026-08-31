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
 * The ramp values below are the mockup's own stops, expressed as multipliers of
 * the gradient's MIDDLE stop — which is the value the instance colour carries.
 * `linear-gradient(180deg, #a5e4ff, #6fcbf5 46%, #3f9fd0)` is a 1.16 → 1.0 →
 * ## The ramp is per-channel, in LINEAR space
 *
 * Two subtleties, both of which took a measured render to find, and between them
 * the reason five earlier attempts never matched the design.
 *
 * **Linear space.** These values multiply LINEAR light, but the design's
 * gradient is authored in sRGB, and gamma encoding compresses ratios: a linear
 * multiplier of 1.32 arrives on screen as 1.32^(1/2.2) ≈ 1.14. A ramp authored
 * as 1.16 → 0.76 measured 1.14:1 top-to-bottom against the design's 1.53:1.
 * Every stop below is therefore an sRGB ratio raised to 2.2, and values above 1
 * are correct.
 *
 * **Per-channel.** The design's gradient is not a brightness ramp — it
 * desaturates as it rises. From #6fcbf5 to #a5e4ff red climbs 49% while blue
 * moves 4%; downward to #3f9fd0 red falls 43% and blue only 15%. A single scalar
 * multiplier cannot express that, so it landed the middle stop exactly and left
 * the top too saturated: measured rgb(123,224,254) against the design's
 * rgb(165,228,255). Each stop is an RGB triple, and the pattern — red varying
 * most, blue least — is also what real light does, since ambient sky fill is
 * blue and keeps shadows cool.
 *
 * Ratios are relative to the gradient's MIDDLE stop, because that is what the
 * instance colour carries — see BRICK_FAMILIES in GameRenderer. Holding the top
 * stop there instead (a pale #a5e4ff rather than a vivid #6fcbf5) is what made
 * the wall look dusty even once the ramp was in place: measured rgb(139,189,227)
 * against rgb(111,203,245).
 *
 * The triples are derived from the cyan family, which is 70% of the wall. The
 * violet accent shares them and comes out slightly cooler at the top than its
 * own gradient would be — an accepted trade rather than a per-family ramp.
 */
export type Shade = readonly [number, number, number];

export const BRICK_SHADING = {
  /**
   * Bevel facing up — the lit top edge.
   *
   * Deliberately far above the face and pushed towards white: this is the
   * mockup's `inset 0 1px 0 rgba(255,255,255,.5)`, a hot 1–2px line that is
   * MEANT to blow out and to be the one part of a brick the bloom pass catches.
   * That is where the design's `0 0 9px -3px <hue>` halo comes from.
   */
  topEdge: [1.9, 1.75, 1.6] as Shade,
  /** Front face at the top. #6fcbf5 → #a5e4ff, per channel, linearised. */
  faceTop: [2.37, 1.39, 1.1] as Shade,
  /** Front face at 46% down: the middle stop itself, hence exactly 1. */
  faceMid: [1, 1, 1] as Shade,
  /** Front face at the bottom. #6fcbf5 → #3f9fd0, per channel, linearised. */
  faceBottom: [0.31, 0.55, 0.69] as Shade,
  /** Bevel facing down — the seated shadow, and the coolest surface. */
  bottomEdge: [0.18, 0.3, 0.42] as Shade,
  /** Left and right walls. */
  side: [0.3, 0.45, 0.58] as Shade,
  /** Rear faces, only ever seen at the board's edges. */
  back: [0.18, 0.28, 0.36] as Shade,
} as const;

/** Depth of the extruded slab, in unit-brick space. */
const DEPTH = 0.42;

/**
 * Corner radius, as a fraction of the brick's SHORTER side.
 *
 * The mockup rounds a 37 × 24 brick by about 5px — a fifth of its height. Both
 * previous attempts got this wrong, in opposite directions and for the same
 * reason: the radius is authored on the UNIT shape and the brick is then scaled
 * non-uniformly (0.845 × 0.511 board units, a 1.65 aspect), so a SINGLE unit
 * radius always comes out as an ellipse. 0.22 gave a 7.4 × 4.5px lozenge; 0.05
 * gave a 2px corner that reads as a plain rectangle — which is what the game
 * shows now.
 *
 * The fix is a separate radius per axis, derived from the aspect ratio, so the
 * corner is actually circular once the instance matrix has scaled it.
 */
export const RADIUS_FRACTION = 0.19;

/**
 * Samples the ramp for one vertex.
 *
 * Exported because the ramp is the design contract: a test asserts that the top
 * of the brick is brighter than the bottom and that the top bevel is the
 * brightest thing on it, so a future tweak cannot silently flatten the wall
 * back out.
 */
export const brickShadeAt = (
  y: number,
  normalX: number,
  normalY: number,
  normalZ: number,
): Shade => {
  // Bevels and walls first — they are the edges that carry the light direction.
  if (normalY > 0.35) return BRICK_SHADING.topEdge;
  if (normalY < -0.35) return BRICK_SHADING.bottomEdge;
  if (Math.abs(normalX) > 0.35) return BRICK_SHADING.side;
  if (normalZ < -0.35) return BRICK_SHADING.back;

  // Front face: the three-stop ramp, top (y = +0.5) to bottom (y = -0.5).
  const t = Math.min(1, Math.max(0, 0.5 - y));
  const [from, to, span, offset] =
    t <= 0.46
      ? ([BRICK_SHADING.faceTop, BRICK_SHADING.faceMid, 0.46, 0] as const)
      : ([BRICK_SHADING.faceMid, BRICK_SHADING.faceBottom, 0.54, 0.46] as const);
  const k = (t - offset) / span;
  return [
    from[0] + (to[0] - from[0]) * k,
    from[1] + (to[1] - from[1]) * k,
    from[2] + (to[2] - from[2]) * k,
  ];
};

/**
 * The unit brick: a 1 × 1 rounded rectangle extruded to a slab, carrying the
 * design's luminance ramp in its `color` attribute.
 *
 * Built at unit size and scaled per instance to the block's real collision box,
 * so the drawn brick is exactly the box the ball bounces off.
 */
export const createBlockGeometry = (options: { bevel?: boolean; aspect?: number } = {}) => {
  const bevel = options.bevel ?? true;
  // Width / height of the brick this geometry will be scaled to. 1.65 is the
  // campaign generator's own ratio (0.845 × 0.511 board units).
  const aspect = options.aspect && options.aspect > 0 ? options.aspect : 1.653;

  // Radius on the short axis, then divided by the aspect on the long one, so
  // both come out the same size in board units after scaling.
  const radiusY = RADIUS_FRACTION;
  const radiusX = RADIUS_FRACTION / aspect;
  const halfX = 0.5 - radiusX;
  const halfY = 0.5 - radiusY;

  // Subdivide the two vertical edges.
  //
  // ExtrudeGeometry triangulates the front cap from the OUTLINE vertices only —
  // there are no interior points — so with a bare rounded rectangle the cap is a
  // handful of triangles spanning the brick's full height. The ramp is then
  // interpolated linearly across them, which erases its knee at 46% and biases
  // the middle: measured, the centre of the face came out at rgb(122,200,236)
  // where the ramp asks for rgb(109,200,241), because interpolating between the
  // hot top and dark bottom overshoots a piecewise curve. Adding vertices up
  // both sides gives earcut something to triangulate BETWEEN, so the baked ramp
  // survives to the pixel. Nine steps is well inside the point of diminishing
  // returns and this is one shared geometry, so the extra vertices are free.
  const EDGE_STEPS = 9;
  const shape = new THREE.Shape();
  const edge = (fromY: number, toY: number, x: number) => {
    for (let step = 1; step <= EDGE_STEPS; step += 1) {
      shape.lineTo(x, fromY + ((toY - fromY) * step) / EDGE_STEPS);
    }
  };

  shape.moveTo(-halfX, -0.5);
  shape.lineTo(halfX, -0.5);
  shape.quadraticCurveTo(0.5, -0.5, 0.5, -halfY);
  edge(-halfY, halfY, 0.5);
  shape.quadraticCurveTo(0.5, 0.5, halfX, 0.5);
  shape.lineTo(-halfX, 0.5);
  shape.quadraticCurveTo(-0.5, 0.5, -0.5, halfY);
  edge(halfY, -halfY, -0.5);
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
  const shade = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    const value = brickShadeAt(
      position.getY(index),
      normal.getX(index),
      normal.getY(index),
      normal.getZ(index),
    );
    shade[index * 3] = value[0];
    shade[index * 3 + 1] = value[1];
    shade[index * 3 + 2] = value[2];
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(shade, 3));

  return geometry;
};
