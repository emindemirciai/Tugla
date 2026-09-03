import type { EngineSnapshot, GameEvent, TuğlaEngine } from '@tugla/game-engine';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createBlockGeometry } from '../lib/block-visuals';
import { createBrickFaceTexture, faceKeyFor, faceSpecFor, KIND_FACES } from '../lib/brick-textures';
import { fitGameCamera, projectPointerToBoardX } from '../lib/game-camera';
import type { ResolvedQuality } from '../lib/settings';

/**
 * Fixed meaning colours.
 *
 * Three of these used to collide with the ordinary-brick pool: TOUGH was
 * byte-identical to tone 1 (#8b7bff), EXPLOSIVE (#ff7a8f) was indistinguishable
 * from tone 6 (#ff8ad0), and FIRE sat on tone 2. A player could not tell a
 * plain brick from one that takes two hits. The kinds below now differ from
 * ordinary bricks by MATERIAL as well as hue — plated slate for TOUGH,
 * dynamite red for EXPLOSIVE — so their colours never have to compete.
 */
export const BLOCK_COLORS: Record<string, number> = {
  NORMAL: 0x52bdf5,
  TOUGH: 0x7b78a8,
  ARMORED: 0x9aa3bd,
  EXPLOSIVE: 0xe5252f,
  ICE: 0xe4f8ff,
  FIRE: 0xff7a45,
  ELECTRIC: 0xffd166,
  MOVING: 0x4fd6a8,
  REGENERATING: 0x7ce8b0,
  // Deeper than the wall's cyan on purpose: at 0x6b9dff it measures 41.8 from
  // the light family tone, under the 45 floor the visuals test enforces, and a
  // shield the player mistakes for an ordinary brick is a wasted mechanic.
  SHIELDED: 0x1f6feb,
  PORTAL: 0xd14dff,
  SPLITTER: 0xff8ad0,
  BONUS: 0xffd166,
  // Barrier structure: cold, dark steel — deliberately the least saturated
  // thing on the board, and deliberately close to ABSORBER, because the two of
  // them are the same category of object (see indestructibleBlockKinds). A gate
  // the ball can never break must not look like a brick that is merely hard,
  // and it must not look like ARMORED, which IS breakable.
  DEFLECTOR: 0x5a6478,
  ABSORBER: 0x6b7390,
  BOSS_CORE: 0xff6b9a,
};

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
  size: number;
}

/**
 * Per-level identity.
 *
 * Every board used to be the same blue because ordinary blocks — the vast
 * majority — had one fixed colour and the paddle was always orange. The world
 * theme now drives the ordinary block hue, the board tint and the grid, while
 * the special kinds keep their fixed meanings (armored grey, explosive red…)
 * so the palette stays informative. The paddle rotates through the palette per
 * level, which makes progress visible at a glance.
 */
const THEME_PALETTES: Record<string, { block: number; board: number; grid: number; glow: number }> =
  {
    // Boards lifted out of near-black.
    //
    // Every one of these was 0x12–0x2a dark, and with the vignette and the fog on
    // top the playfield read as a cave: the bricks were the only lit thing on
    // screen, so the game looked dreary however well the bricks themselves were
    // shaded. A brick-breaker board should be a lit stage, not a void. Same
    // hues, roughly doubled in value — each world keeps its identity and the
    // bricks still sit clearly in front of it.
    'neon-grid': { block: 0x52bdf5, board: 0x2f2470, grid: 0x3a2f6b, glow: 0x8b6cff },
    'crystal-core': { block: 0x8b7bff, board: 0x342b7a, grid: 0x453a86, glow: 0xb9a8ff },
    'solar-forge': { block: 0xff9a6b, board: 0x46284f, grid: 0x5c3350, glow: 0xffb27a },
    'frozen-circuit': { block: 0x7fd8ef, board: 0x1e4468, grid: 0x2b5474, glow: 0xa8f0ff },
    'dark-matter': { block: 0xc07bff, board: 0x2c1e52, grid: 0x3d2a63, glow: 0xd6b6ff },
    'quantum-lab': { block: 0x4fd6a8, board: 0x1d4a56, grid: 0x2b5f63, glow: 0x7ce8b0 },
    'magma-vein': { block: 0xff7a8f, board: 0x4a1f4c, grid: 0x63274f, glow: 0xffb27a },
    'aurora-field': { block: 0x6ad2ff, board: 0x223a62, grid: 0x2f4a75, glow: 0x9dffe0 },
    'void-garden': { block: 0xffd166, board: 0x3a2c60, grid: 0x4b3a73, glow: 0xffe6a3 },
    singularity: { block: 0xff8ad0, board: 0x352158, grid: 0x4a2a6b, glow: 0xffa8e0 },
  };

const DEFAULT_PALETTE = THEME_PALETTES['neon-grid']!;

/** Paddle colours cycle per level so two neighbours never look alike. */
const PADDLE_COLORS = [
  { color: 0xffc7a3, emissive: 0xff7a45 },
  { color: 0xa8f0ff, emissive: 0x2497b8 },
  { color: 0xd8ffe9, emissive: 0x12b886 },
  { color: 0xe4d2ff, emissive: 0x7c5cff },
  { color: 0xffe6a3, emissive: 0xf5a524 },
  { color: 0xffc2d6, emissive: 0xe5487f },
];

/**
 * Ordinary bricks: two colour families, three depth steps each.
 *
 * The seven-tone pool painted the wall as a random rainbow AND collided with
 * the meaning colours above. Two families keep the board colourful without
 * noise, and stepping the tone by row band makes the wall read as a lit relief
 * rather than a flat sheet — deeper rows sit darker, exactly as they would
 * under the key light. The same board always paints the same way, because the
 * family and the step are derived from the brick's authored position.
 *
 * ## Why these exact hues
 *
 * The dominant family used to be warm — #ffb389 / #f0855a / #dc7450 — at 70% of
 * the wall. Orange at that saturation is the one hue that turns to MUD as soon
 * as it is under-lit, and that is precisely what the board looked like: brown
 * bricks with a few steel-blue ones, nothing like the design. The design's wall
 * is cool: cyan as the body, violet as the accent.
 *
 * These are the MIDDLE stop of each row band's gradient, not its top stop. The
 * distinction is the whole ball game: the vertex ramp in block-visuals.ts is
 * authored relative to the middle stop, so holding #a5e4ff here (band 0's TOP
 * stop) made the renderer darken an already-pale blue and the wall came out
 * dusty. Measured against a real render, the middle stop lands the face within
 * one or two units of the design's own pixels.
 */
/**
 * Ordinary-brick hues, kept only as a fallback.
 *
 * The wall's real appearance now comes from the canvas face textures in
 * brick-textures.ts (WALL_FACES), which carry the design's gradient stops AND
 * the per-kind surface detail. These hexes are the middle stop of each of those
 * six gradients, used to tint the flat material when there is no 2D canvas to
 * paint a texture on — server rendering and unit tests.
 */
export const BRICK_FAMILIES = [
  // Cyan body — the wall's dominant material. Bands: light, mid, deep.
  [0x6fcbf5, 0x52bdf5, 0x3d9fd4],
  // Violet accent.
  [0x9c8bff, 0x7a68f0, 0x6252d0],
] as const;

/** Row band → depth step, for the no-canvas fallback palette. */
export const depthStep = (row: number) => {
  const band = ((row % 9) + 9) % 9;
  return band < 3 ? 0 : band < 6 ? 1 : 2;
};

/** One equipped catalogue item, as the session hands it over. */
export interface Cosmetic {
  sku: string;
  category: string;
  metadata: unknown;
}

/**
 * Reads a colour from a cosmetic's metadata.
 *
 * Catalogue metadata is free-form JSON written by staff in the admin panel, so
 * it is treated as untrusted: anything that is not a `#rrggbb` string is
 * ignored and the level's own colour stands. A malformed shop item should look
 * like nothing happened, not break the renderer.
 */
export const cosmeticColour = (cosmetics: Cosmetic[], category: string): number | null => {
  const match = cosmetics.find((item) => item.category === category);
  const value = (match?.metadata as { color?: unknown } | undefined)?.color;
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) return null;
  return Number.parseInt(value.slice(1), 16);
};

export interface LevelStyle {
  theme: string;
  index: number;
}

/**
 * Three.js presentation layer.
 *
 * Rendering is entirely driven by the engine snapshot: this class owns no game
 * state. Balls and blocks use instanced meshes so 500 simultaneous balls stay a
 * handful of draw calls rather than 500.
 */
export class GameRenderer {
  /** Warn once per page, not once per face group. */
  private static warnedAboutTextures = false;

  private readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;
  /** Bloom pipeline. Null below HIGH quality, where the scene renders direct. */
  private composer: EffectComposer | null = null;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly palette: (typeof THEME_PALETTES)[string];
  private safetyNet: THREE.Mesh | null = null;
  /** Paddle laser beam, shown while the LASER bonus runs. */
  private laserBeam: THREE.Mesh | null = null;
  /**
   * One InstancedMesh per distinct brick face.
   *
   * A single instanced mesh can only carry one flat colour per brick, which is
   * why every block in the game used to be a plain slab however well it was
   * shaded: the design differentiates kinds by MATERIAL — rivets and a crack on
   * TOUGH, ribbed plate on ARMORED, a lit ring on SHIELDED, an ember core in
   * FIRE — and none of that can live in a per-instance colour. Grouping by face
   * lets each group carry its own texture. A campaign board shows eight to ten
   * groups, so this trades one draw call for about ten.
   */
  private readonly blockGroups = new Map<string, { mesh: THREE.InstancedMesh; blocks: number[] }>();
  private readonly ballMesh: THREE.InstancedMesh;
  private readonly bonusMesh: THREE.InstancedMesh;
  private readonly paddle: THREE.Mesh;
  private readonly trailMesh: THREE.InstancedMesh | null = null;
  /** Dynamite bodies for EXPLOSIVE blocks, keyed by block index. */
  private readonly dynamite = new Map<number, { group: THREE.Group; fuse: THREE.Mesh }>();
  private readonly particleGeometry = new THREE.BufferGeometry();
  private readonly particlePoints: THREE.Points;
  private particles: Particle[] = [];
  private readonly trailHistory: THREE.Vector3[] = [];
  private readonly disposables: { dispose(): void }[] = [];

  private readonly tempMatrix = new THREE.Matrix4();
  private readonly tempPosition = new THREE.Vector3();
  private readonly tempScale = new THREE.Vector3();
  private readonly tempQuaternion = new THREE.Quaternion();

  constructor(
    private readonly mount: HTMLElement,
    private readonly engine: TuğlaEngine,
    private quality: ResolvedQuality,
    private readonly levelStyle: LevelStyle = { theme: 'neon-grid', index: 1 },
    /**
     * Equipped cosmetics. Visual only, by design: they are applied to materials
     * and never to the simulation, so what a player owns can never change a
     * score the server has to reproduce.
     */
    private readonly cosmetics: Cosmetic[] = [],
  ) {
    const palette = THEME_PALETTES[levelStyle.theme] ?? DEFAULT_PALETTE;
    this.palette = palette;
    const paddleTone = PADDLE_COLORS[(levelStyle.index - 1) % PADDLE_COLORS.length]!;
    const viewportWidth = mount.clientWidth;
    const viewportHeight = mount.clientHeight;
    this.renderer = new THREE.WebGLRenderer({
      antialias: quality.antialias,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
    this.renderer.setSize(viewportWidth, viewportHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Linear, not ACES.
    //
    // ACES applies a filmic S-curve that rolls highlights off hard and
    // desaturates as it does so. That is right for photographic realism and
    // wrong here: it was compressing the top of the brick's baked gradient
    // (1.55 at the lit edge, 1.28 at the top of the face) into nearly the same
    // output value, so the ramp this renderer goes to the trouble of baking
    // arrived on screen almost flat. The design is a flat, vivid, sRGB
    // composition — a linear transfer is what reproduces it.
    this.renderer.toneMapping = THREE.LinearToneMapping;
    // Unity.
    //
    // Tuned together with the two lights and the emissive trace below so the
    // top of a brick face lands at ~0.95 — bright, and just under clipping.
    // Anything else here and that budget has to be re-derived; see the table in
    // README before changing it.
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(this.renderer.domElement);

    // Fog was eating a third of every brick.
    //
    // The board sits roughly 25 units from the camera, and FogExp2 at density
    // 0.026 blends by 1 - exp(-(0.026 × 25)²) ≈ 34% at that distance — so every
    // brick was mixed a third of the way into dark purple before it reached the
    // screen. That, more than any material setting, is why the wall looked
    // dull and desaturated next to the design. Kept, but as a whisper: enough
    // to give the board depth at its edges, not enough to grey out the bricks.
    // Fog follows the board colour.
    //
    // It was hard-coded to 0x171034 — far darker than any board — so what little
    // fog remains was still dragging distant bricks toward near-black instead of
    // toward the board behind them. Fog should be the colour of the air, and
    // here the air is whatever the world's board is.
    this.scene.fog = new THREE.FogExp2(palette.board, 0.008);
    this.camera = new THREE.PerspectiveCamera();
    fitGameCamera(this.camera, {
      boardWidth: engine.width,
      boardHeight: engine.height,
      viewportWidth,
      viewportHeight,
    });

    this.buildLighting();
    this.buildBoard();
    this.buildBlockGroups(quality);
    this.buildDynamite();

    const ballGeometry = new THREE.SphereGeometry(
      1,
      quality.level === 'LOW' ? 8 : 16,
      quality.level === 'LOW' ? 6 : 12,
    );
    const ballMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xfff6ef,
      emissive: 0xffb27a,
      emissiveIntensity: quality.bloom ? 1.8 : 1.2,
      roughness: 0.08,
      metalness: 0.25,
    });
    this.ballMesh = new THREE.InstancedMesh(ballGeometry, ballMaterial, engine.maxBalls);
    this.ballMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ballMesh.frustumCulled = false;
    this.ballMesh.count = 0;
    this.scene.add(this.ballMesh);
    this.disposables.push(ballGeometry, ballMaterial);

    const bonusGeometry = new THREE.CylinderGeometry(0.17, 0.17, 0.34, 8);
    const bonusMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xd8ffe9,
      emissive: 0x4fd6a8,
      emissiveIntensity: 1.4,
      roughness: 0.2,
      metalness: 0.4,
    });
    this.bonusMesh = new THREE.InstancedMesh(bonusGeometry, bonusMaterial, 64);
    this.bonusMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bonusMesh.frustumCulled = false;
    this.bonusMesh.count = 0;
    this.scene.add(this.bonusMesh);
    this.disposables.push(bonusGeometry, bonusMaterial);

    if (quality.trailLength > 0) {
      const trailGeometry = new THREE.SphereGeometry(1, 6, 4);
      const trailMaterial = new THREE.MeshBasicMaterial({
        color: cosmeticColour(cosmetics, 'trail') ?? 0xffd9c2,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      });
      this.trailMesh = new THREE.InstancedMesh(trailGeometry, trailMaterial, quality.trailLength);
      this.trailMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.trailMesh.frustumCulled = false;
      this.trailMesh.count = 0;
      this.scene.add(this.trailMesh);
      this.disposables.push(trailGeometry, trailMaterial);
    }

    // Rounded ends: a plain box reads as a bar, a capsule reads as a paddle.
    // Built from a cylinder laid on its side so it stays one draw call.
    const paddleGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1);
    paddleGeometry.rotateZ(Math.PI / 2);
    paddleGeometry.scale(1, 1, 0.55);
    const paddleMaterial = new THREE.MeshPhysicalMaterial({
      color: cosmeticColour(cosmetics, 'paddle') ?? paddleTone.color,
      emissive: paddleTone.emissive,
      emissiveIntensity: 0.6,
      metalness: 0.65,
      roughness: 0.18,
    });
    this.paddle = new THREE.Mesh(paddleGeometry, paddleMaterial);
    // No cast shadow under the paddle: it lands directly beneath it and reads
    // as a black hole punched into the board rather than depth.
    this.paddle.castShadow = false;
    this.scene.add(this.paddle);
    this.disposables.push(paddleGeometry, paddleMaterial);

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.particleGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(quality.maxParticles * 3), 3),
    );
    this.particleGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(quality.maxParticles * 3), 3),
    );
    this.particlePoints = new THREE.Points(this.particleGeometry, particleMaterial);
    this.particlePoints.frustumCulled = false;
    // Until the first update every point sits at the origin; drawing them would
    // put a bright dot on the board.
    this.particleGeometry.setDrawRange(0, 0);
    this.scene.add(this.particlePoints);
    this.disposables.push(this.particleGeometry, particleMaterial);

    this.buildComposer(viewportWidth, viewportHeight);
  }

  /**
   * Builds one InstancedMesh per distinct brick face.
   *
   * Blocks are grouped by their face key — the kind for anything with a fixed
   * meaning, otherwise the wall variant its authored position selects. Each
   * group gets a canvas texture painted with the design's own gradient stops and
   * surface detail (see brick-textures.ts), on an unlit material so the output
   * IS that texture: no light to tune, no specular term to fight, no linear-to-
   * sRGB conversion to get wrong.
   *
   * A block's kind never changes at runtime, so the grouping is fixed for the
   * life of the level and `render` only has to write matrices.
   */
  private buildBlockGroups(quality: ResolvedQuality) {
    const geometry = createBlockGeometry({ bevel: quality.level !== 'LOW' });
    this.disposables.push(geometry);

    const keyed = new Map<string, number[]>();
    this.engine.snapshot.blocks.forEach((block, index) => {
      const key = faceKeyFor(block.kind, Math.round(block.origin.x), Math.round(block.origin.y));
      const bucket = keyed.get(key);
      if (bucket) bucket.push(index);
      else keyed.set(key, [index]);
    });

    for (const [key, blocks] of keyed) {
      const texture = createBrickFaceTexture(faceSpecFor(key));
      if (texture) {
        this.disposables.push(texture);
      } else if (!GameRenderer.warnedAboutTextures) {
        // Without this the board silently loses every crack, rivet and rib and
        // looks exactly like the flat wall the texture work replaced — which is
        // indistinguishable from "the change did nothing".
        GameRenderer.warnedAboutTextures = true;
        console.warn(
          'Brick face textures could not be created (no 2D canvas); falling back to flat colours.',
        );
      }
      const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        map: texture,
        // Without a canvas (SSR, unit tests) fall back to the face's middle stop
        // so the board still renders, just without the material detail.
        color: texture ? 0xffffff : this.fallbackColorFor(key),
      });
      const mesh = new THREE.InstancedMesh(geometry, material, blocks.length);
      mesh.castShadow = quality.shadows;
      mesh.receiveShadow = quality.shadows;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // Blocks are spread across the whole board, so a group's bounding sphere
      // is the board: culling it per group buys nothing and risks popping.
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.disposables.push(material);
      this.blockGroups.set(key, { mesh, blocks });
    }
  }

  /** Flat colour for a face, for the no-canvas fallback. */
  private fallbackColorFor(key: string) {
    if (key.startsWith('k:')) {
      return BLOCK_COLORS[key.slice(2)] ?? this.palette.block;
    }
    const variant = Number(key.slice(2));
    return BRICK_FAMILIES[Math.floor(variant / 3)]![variant % 3]!;
  }

  /**
   * The halo.
   *
   * Every brick in the design carries `box-shadow: 0 0 9px -3px <hue>` — a
   * coloured glow bleeding onto the board. Nothing in a plain forward render
   * can produce that: `quality.bloom` existed in the settings but was read in
   * exactly one place, to scale the ball's emissive intensity, so no glow was
   * ever drawn. This is the pass that was missing.
   *
   * Thresholded at 0.75 so it lifts the emissive edges, the ball and the
   * dynamite rather than fogging the whole board, and gated on quality: bloom
   * is a full-screen pass and phones on the LOW preset should not pay for it.
   */
  private buildComposer(width: number, height: number) {
    if (!this.quality.bloom || width === 0 || height === 0) return;
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));
    composer.addPass(
      // Threshold 0.82 in LINEAR light, which is what the pass sees inside the
      // composer. It sits between a brick's face (linear luminance ~0.74) and
      // its lit top bevel (~0.90), so only the bevel, the ball, the fuse spark
      // and the laser get a halo. That bevel glow is the design's
      // `0 0 9px -3px <hue>` box-shadow. At 0.75 the FACES bloomed too, which
      // hazed the whole wall and destroyed the very gradient the vertex colours
      // exist to draw.
      new UnrealBloomPass(new THREE.Vector2(width, height), 0.4, 0.4, 0.82),
    );
    // OutputPass applies tone mapping and the sRGB conversion at the end of the
    // chain; without it the composer would write linear values straight out and
    // the whole board would come back washed out.
    composer.addPass(new OutputPass());
    this.composer = composer;
  }

  /**
   * Dynamite bodies for EXPLOSIVE blocks.
   *
   * The kind used to be marked by colour alone, which is invisible next to a
   * pink ordinary brick — players had no way to know which brick would take its
   * neighbours with it until it did. A red stick with cream end caps, two dark
   * bands and a lit fuse says it without a legend, and it survives the board
   * being scaled down to a phone because the silhouette carries the meaning,
   * not the hue.
   *
   * These are real meshes rather than instances: EXPLOSIVE blocks are a handful
   * per board, so a group each costs nothing and buys per-brick fuse animation.
   */
  private buildDynamite() {
    const explosive = this.engine.snapshot.blocks
      .map((block, index) => ({ block, index }))
      .filter((entry) => entry.block.kind === 'EXPLOSIVE');
    if (explosive.length === 0) return;

    // A slab, not a tube.
    //
    // This was a sideways CylinderGeometry — a round pill sitting in a grid of
    // flat bricks, with disc caps and ring bands. It read as a capsule, which
    // is why it was the one piece that looked closest to the design and still
    // looked wrong. The design's dynamite is brick-SHAPED: the same slab as
    // every other block, in red, with flat cream caps at each end, two dark
    // vertical bands and a fuse. Reusing the brick geometry is also what makes
    // it sit in the wall instead of on top of it.
    // Same slab as every other brick, wearing the EXPLOSIVE face: red body,
    // cream end caps, two dark bands and a stencilled TNT label, all painted
    // into the texture. It was a sideways cylinder for two rounds — a round pill
    // in a grid of flat bricks — and then a red slab with four box meshes laid
    // over its front, which read as pale vertical bars rather than a stick.
    // Reusing the brick geometry is also what makes it sit IN the wall instead
    // of on top of it.
    const bodyGeometry = createBlockGeometry({ bevel: this.quality.level !== 'LOW' });
    // Unlit like the bricks, so the stick answers to light exactly as the wall
    // around it does. Cream end caps, dark bands and the stencilled TNT label
    // are painted into the face texture (see brick-textures.ts).
    // They used to be four separate box meshes laid over the front of the
    // block, which read as four pale vertical bars on a red brick rather than a
    // stick of dynamite. In the texture they are drawn at the design's own
    // proportions and cost nothing.
    const bodyTexture = createBrickFaceTexture(KIND_FACES.EXPLOSIVE!);
    if (bodyTexture) this.disposables.push(bodyTexture);
    const bodyMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      map: bodyTexture,
      color: bodyTexture ? 0xffffff : 0xe5252f,
    });
    // The fuse: a short arc rising off the top edge, then the spark.
    const fuseGeometry = new THREE.TorusGeometry(0.13, 0.022, 6, 10, Math.PI * 0.9);
    const fuseMaterial = new THREE.MeshBasicMaterial({ color: 0xd8bd8c });
    const sparkGeometry = new THREE.SphereGeometry(0.075, 10, 8);
    // Basic, not standard: the spark is a light source in the fiction, so it
    // must not be shaded by the scene — and being the brightest thing on the
    // board is what makes the bloom pass halo it.
    const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });

    this.disposables.push(
      bodyGeometry,
      bodyMaterial,
      fuseGeometry,
      fuseMaterial,
      sparkGeometry,
      sparkMaterial,
    );

    for (const { block, index } of explosive) {
      const group = new THREE.Group();

      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.castShadow = this.quality.shadows;
      group.add(body);

      const fuseArc = new THREE.Mesh(fuseGeometry, fuseMaterial);
      // Rotated so the arc leans out of the top-right corner, as in the design.
      fuseArc.position.set(0.16, 0.5, 0.1);
      fuseArc.rotation.z = -Math.PI * 0.35;
      group.add(fuseArc);

      const fuse = new THREE.Mesh(sparkGeometry, sparkMaterial);
      fuse.position.set(0.3, 0.68, 0.1);
      group.add(fuse);

      // Board-space placement, then scaled to the brick's real footprint so the
      // stick sits exactly where the collision box is.
      //
      // Every campaign brick is the same shape (0.102 × 0.038 board units, a
      // 2.7:1 ratio), so the caps keep their proportions. A future level type
      // with a much narrower brick would squash them on one axis; the fix would
      // be to scale the group uniformly by the smaller dimension and centre it.
      group.position.set(block.position.x, block.position.y, 0.14);
      group.scale.set(block.size.x, block.size.y, Math.min(block.size.x, block.size.y));
      this.scene.add(group);
      this.dynamite.set(index, { group, fuse });
    }
  }

  private buildLighting() {
    // The bricks are unlit (see blockMaterial), so these serve the paddle, the
    // board, the rails and the falling bonuses. Back to ordinary values: they
    // were pushed to 4.74 / 1.2 while the bricks still depended on them, which
    // blew out every other surface on the board.
    this.scene.add(new THREE.HemisphereLight(0xbaa6ff, 0x171034, 1));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-5, 16, 10);
    key.castShadow = this.quality.shadows;
    if (this.quality.shadows) {
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 40;
    }
    this.scene.add(key);
    // Placed well outside the field: close to the board it produced a visible
    // specular dot instead of ambience.
    const accent = new THREE.PointLight(this.palette.glow, 60, 60);
    accent.position.set(this.engine.width + 7, this.engine.height * 0.75, 14);
    this.scene.add(accent);
  }

  private buildBoard() {
    // Same colour behind and on the board, so no seam is visible where the
    // board ends and the canvas begins.
    this.renderer.setClearColor(this.palette.board, 1);
    this.scene.background = new THREE.Color(this.palette.board);

    // Generously oversized: the board should always reach past the viewport so
    // its edge never becomes a visible band.
    const geometry = new THREE.BoxGeometry(this.engine.width * 3, this.engine.height * 2, 0.35);
    // Matte on purpose. The board used to be a clearcoated, half-metallic
    // surface, so the accent point light burned a small round highlight into it
    // — the "white ball stuck in the background" players kept reporting. A
    // backdrop must not be glossy: no clearcoat, no metalness, rough enough that
    // no point light can leave a hotspot on it.
    const material = new THREE.MeshStandardMaterial({
      color: this.palette.board,
      roughness: 1,
      metalness: 0,
    });
    const board = new THREE.Mesh(geometry, material);
    board.position.set(this.engine.width / 2, this.engine.height / 2, -0.45);
    board.receiveShadow = this.quality.shadows;
    this.scene.add(board);
    this.disposables.push(geometry, material);

    // No grid overlay and no vignette.
    //
    // The vignette plane sat at z = -0.6 while the board sits at -0.45, so the
    // board occluded it completely: it darkened nothing, cost a transparent
    // full-board draw every frame, and its comment claimed a purpose it had
    // never served. Depth at the edges comes from the fog and the rails.
    const netGeometry = new THREE.PlaneGeometry(this.engine.width, 0.12);
    const netMaterial = new THREE.MeshBasicMaterial({
      color: 0x7ce8b0,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.safetyNet = new THREE.Mesh(netGeometry, netMaterial);
    this.safetyNet.position.set(this.engine.width / 2, 0.16, 0.3);
    this.safetyNet.visible = false;
    this.scene.add(this.safetyNet);
    this.disposables.push(netGeometry, netMaterial);

    // Laser beam. The bonus fires five shots a second at the block above the
    // paddle; without a beam the only feedback was bricks breaking for no
    // visible reason.
    const beamGeometry = new THREE.PlaneGeometry(0.1, this.engine.height);
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe6a3,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    this.laserBeam = new THREE.Mesh(beamGeometry, beamMaterial);
    this.laserBeam.visible = false;
    this.scene.add(this.laserBeam);
    this.disposables.push(beamGeometry, beamMaterial);

    // Playfield rails.
    //
    // Making the backdrop one flat colour removed the two-tone seam but also
    // removed every cue about where the walls are, so the board became a void.
    // These three rails mark the exact bounds the ball bounces off — a
    // deliberate frame rather than an artefact of two surfaces meeting.
    const railMaterial = new THREE.MeshStandardMaterial({
      color: this.palette.glow,
      emissive: this.palette.glow,
      // The rails are a frame, not the subject. At 0.55 with bloom on they were
      // the loudest thing on screen and pulled the eye off the wall.
      emissiveIntensity: 0.3,
      roughness: 0.6,
      metalness: 0,
    });
    const railThickness = 0.1;
    const verticalRail = new THREE.BoxGeometry(railThickness, this.engine.height, 0.5);
    const horizontalRail = new THREE.BoxGeometry(
      this.engine.width + railThickness,
      railThickness,
      0.5,
    );
    const left = new THREE.Mesh(verticalRail, railMaterial);
    left.position.set(0, this.engine.height / 2, 0);
    const right = new THREE.Mesh(verticalRail, railMaterial);
    right.position.set(this.engine.width, this.engine.height / 2, 0);
    const top = new THREE.Mesh(horizontalRail, railMaterial);
    top.position.set(this.engine.width / 2, this.engine.height, 0);
    for (const rail of [left, right, top]) this.scene.add(rail);
    this.disposables.push(verticalRail, horizontalRail, railMaterial);
  }

  /** Spawns fragmentation particles for destruction and impact events. */
  emitEvents(events: GameEvent[]) {
    if (this.quality.maxParticles === 0) return;
    for (const event of events) {
      if (event.x === undefined || event.y === undefined) continue;
      const budget = this.quality.maxParticles - this.particles.length;
      if (budget <= 0) break;

      let count = 0;
      let colour = 0xdcd2ff;
      let speed = 2.4;
      if (event.type === 'BLOCK_DESTROYED') {
        count = Math.min(budget, this.quality.level === 'HIGH' ? 14 : 8);
        colour = 0x8fd9ff;
      } else if (event.type === 'BLOCK_EXPLODED') {
        // A dynamite stick has to go off like one: more fragments, faster, and
        // in fuse-spark yellow rather than the old pink, which read as just
        // another brick breaking.
        count = Math.min(budget, this.quality.level === 'HIGH' ? 40 : 20);
        colour = 0xffc454;
        speed = 5.4;
      } else if (event.type === 'BOSS_DEFEATED') {
        count = Math.min(budget, this.quality.maxParticles / 2);
        colour = 0xff6b9a;
        speed = 5;
      } else if (event.type === 'BALL_LOST') {
        count = Math.min(budget, 6);
        colour = 0xff9a6b;
      } else if (event.type === 'BONUS_COLLECTED') {
        count = Math.min(budget, 8);
        colour = 0x7ce8b0;
      }

      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const magnitude = speed * (0.4 + Math.random() * 0.9);
        this.particles.push({
          position: new THREE.Vector3(event.x, event.y, 0.4),
          velocity: new THREE.Vector3(
            Math.cos(angle) * magnitude,
            Math.sin(angle) * magnitude,
            (Math.random() - 0.5) * 1.4,
          ),
          life: 0.55 + Math.random() * 0.4,
          maxLife: 0.95,
          color: new THREE.Color(colour),
          size: 0.1,
        });
      }
    }
  }

  private updateParticles(delta: number) {
    const positions = this.particleGeometry.getAttribute('position') as THREE.BufferAttribute;
    const colors = this.particleGeometry.getAttribute('color') as THREE.BufferAttribute;
    let write = 0;
    const next: Particle[] = [];
    for (const particle of this.particles) {
      particle.life -= delta;
      if (particle.life <= 0) continue;
      particle.velocity.y -= delta * 5.4;
      particle.position.addScaledVector(particle.velocity, delta);
      if (write < this.quality.maxParticles) {
        positions.setXYZ(write, particle.position.x, particle.position.y, particle.position.z);
        const fade = Math.max(0, particle.life / particle.maxLife);
        colors.setXYZ(
          write,
          particle.color.r * fade,
          particle.color.g * fade,
          particle.color.b * fade,
        );
        write += 1;
      }
      next.push(particle);
    }
    this.particles = next;
    this.particleGeometry.setDrawRange(0, write);
    positions.needsUpdate = true;
    colors.needsUpdate = true;
  }

  private updateTrail(snapshot: EngineSnapshot) {
    if (!this.trailMesh) return;
    const lead = snapshot.balls[0];
    if (lead && snapshot.status === 'RUNNING') {
      this.trailHistory.unshift(new THREE.Vector3(lead.position.x, lead.position.y, 0.45));
      if (this.trailHistory.length > this.quality.trailLength) this.trailHistory.pop();
    } else if (this.trailHistory.length) {
      // Not running: drop the whole tail at once instead of one point per frame,
      // which used to leave a lingering dot on the board.
      this.trailHistory.length = 0;
    }
    this.trailMesh.count = this.trailHistory.length;
    this.trailHistory.forEach((point, index) => {
      const scale = 0.1 * (1 - index / Math.max(1, this.quality.trailLength)) * 1.1;
      this.tempScale.setScalar(Math.max(0.01, scale));
      this.tempMatrix.compose(point, this.tempQuaternion, this.tempScale);
      this.trailMesh!.setMatrixAt(index, this.tempMatrix);
    });
    this.trailMesh.instanceMatrix.needsUpdate = true;
  }

  render(delta: number) {
    const snapshot = this.engine.snapshot;

    for (const { mesh, blocks } of this.blockGroups.values()) {
      blocks.forEach((blockIndex, slot) => {
        const block = snapshot.blocks[blockIndex];
        if (!block) return;
        // An EXPLOSIVE block is drawn by its dynamite group instead. Both are
        // the same slab at the same place, so leaving the instance visible would
        // put two coincident surfaces in the depth buffer and z-fight.
        const visible = block.active && !this.dynamite.has(blockIndex);
        this.tempPosition.set(block.position.x, block.position.y, 0.1);
        // Draw the real collision box.
        //
        // This used to be 0.92 × 0.84, so a 36.7 × 24.3 px brick was drawn at
        // 33.8 × 20.4 — the ball visibly bounced off empty space, and because
        // the two factors differ the vertical mortar line ended up 1.6× the
        // horizontal one, which is why the wall looked like floating sweets
        // instead of brickwork. The mortar line comes from the level's pitch,
        // not from shrinking every brick.
        this.tempScale.set(visible ? block.size.x : 0, visible ? block.size.y : 0, visible ? 1 : 0);
        this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
        mesh.setMatrixAt(slot, this.tempMatrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }

    // Dynamite follows its block — including MOVING ones — and its fuse
    // breathes so the threat is legible even on a still board.
    if (this.dynamite.size) {
      const spark = 0.8 + Math.sin(snapshot.tick * 0.09) * 0.25;
      for (const [index, entry] of this.dynamite) {
        const block = snapshot.blocks[index];
        if (!block) continue;
        entry.group.visible = block.active;
        if (!block.active) continue;
        entry.group.position.set(block.position.x, block.position.y, 0.14);
        entry.fuse.scale.setScalar(spark);
      }
    }

    // Retired balls stay in the snapshot until the next tick prunes them, and
    // the game does not tick while it waits for a launch — so an inactive ball
    // would hang on screen as a frozen dot. Draw only live ones.
    const balls = snapshot.balls.filter((ball) => ball.active);
    this.ballMesh.count = Math.min(balls.length, this.engine.maxBalls);
    for (let index = 0; index < this.ballMesh.count; index += 1) {
      const ball = balls[index]!;
      this.tempPosition.set(ball.position.x, ball.position.y, 0.5);
      this.tempScale.setScalar(ball.radius * (balls.length === 1 ? 1.12 : 1));
      this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
      this.ballMesh.setMatrixAt(index, this.tempMatrix);
    }
    this.ballMesh.instanceMatrix.needsUpdate = true;

    const bonuses = snapshot.bonuses;
    this.bonusMesh.count = Math.min(bonuses.length, 64);
    for (let index = 0; index < this.bonusMesh.count; index += 1) {
      const bonus = bonuses[index]!;
      this.tempPosition.set(bonus.position.x, bonus.position.y, 0.6);
      this.tempQuaternion.setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        snapshot.tick * 0.05 + index,
      );
      this.tempScale.setScalar(1);
      this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
      this.bonusMesh.setMatrixAt(index, this.tempMatrix);
    }
    this.tempQuaternion.identity();
    this.bonusMesh.instanceMatrix.needsUpdate = true;

    // Safety net: a lit floor line for the seconds the bonus lasts.
    if (this.safetyNet) {
      const active = snapshot.safetyNetTicks > 0;
      this.safetyNet.visible = active;
      if (active) {
        const material = this.safetyNet.material as THREE.MeshBasicMaterial;
        // Fade out over the last second so its end is never a surprise.
        material.opacity = Math.min(1, snapshot.safetyNetTicks / 120) * 0.9;
      }
    }

    const paddle = snapshot.paddle;
    this.paddle.position.set(paddle.x, paddle.y, 0.34);
    this.paddle.scale.set(paddle.width, paddle.height, 1);

    if (this.laserBeam) {
      const firing = paddle.laserTicks > 0;
      this.laserBeam.visible = firing;
      if (firing) {
        this.laserBeam.position.set(paddle.x, this.engine.height / 2 + paddle.y, 0.2);
        const material = this.laserBeam.material as THREE.MeshBasicMaterial;
        // Pulses on the firing cadence, so the beam looks like repeated shots
        // rather than a static line.
        material.opacity = 0.24 + Math.abs(Math.sin(snapshot.tick * 0.13)) * 0.4;
      }
    }

    this.updateTrail(snapshot);
    this.updateParticles(delta);
    if (this.composer) this.composer.render(delta);
    else this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;
    if (!width || !height) return;
    fitGameCamera(this.camera, {
      boardWidth: this.engine.width,
      boardHeight: this.engine.height,
      viewportWidth: width,
      viewportHeight: height,
    });
    this.renderer.setSize(width, height);
    this.composer?.setSize(width, height);
  }

  /** Board-space X for a client pointer position. */
  /**
   * Projects a screen X onto the paddle plane.
   *
   * Mapping the canvas width straight onto the board was wrong as soon as the
   * camera started letterboxing the field: the board covers only part of the
   * canvas, so the paddle trailed the finger and felt sluggish. Ray-casting
   * against the plane the paddle lives on puts it exactly under the pointer at
   * any aspect ratio.
   */
  pointerToBoardX(clientX: number, clientY?: number) {
    return projectPointerToBoardX({
      camera: this.camera,
      rect: this.renderer.domElement.getBoundingClientRect(),
      clientX,
      clientY,
      boardWidth: this.engine.width,
    });
  }

  get domElement() {
    return this.renderer.domElement;
  }

  dispose() {
    for (const { mesh } of this.blockGroups.values()) this.scene.remove(mesh);
    this.blockGroups.clear();
    for (const entry of this.dynamite.values()) this.scene.remove(entry.group);
    this.dynamite.clear();
    for (const item of this.disposables) item.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.mount) {
      this.mount.removeChild(this.renderer.domElement);
    }
  }
}
