import type { EngineSnapshot, GameEvent, TuğlaEngine } from '@tugla/game-engine';
import * as THREE from 'three';
import { fitGameCamera } from '../lib/game-camera';
import type { ResolvedQuality } from '../lib/settings';

const BLOCK_COLORS: Record<string, number> = {
  NORMAL: 0x52bdf5,
  TOUGH: 0x8b7bff,
  ARMORED: 0x9aa3bd,
  EXPLOSIVE: 0xff7a8f,
  ICE: 0x7fd8ef,
  FIRE: 0xff9a6b,
  ELECTRIC: 0xffd166,
  MOVING: 0x4fd6a8,
  REGENERATING: 0x7ce8b0,
  SHIELDED: 0x6b9dff,
  PORTAL: 0xc07bff,
  SPLITTER: 0xff8ad0,
  BONUS: 0xffd166,
  DEFLECTOR: 0xcbd5e6,
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
    'neon-grid': { block: 0x52bdf5, board: 0x1d1540, grid: 0x3a2f6b, glow: 0x8b6cff },
    'crystal-core': { block: 0x8b7bff, board: 0x201a4d, grid: 0x453a86, glow: 0xb9a8ff },
    'solar-forge': { block: 0xff9a6b, board: 0x2a1733, grid: 0x5c3350, glow: 0xffb27a },
    'frozen-circuit': { block: 0x7fd8ef, board: 0x122a44, grid: 0x2b5474, glow: 0xa8f0ff },
    'dark-matter': { block: 0xc07bff, board: 0x1a1130, grid: 0x3d2a63, glow: 0xd6b6ff },
    'quantum-lab': { block: 0x4fd6a8, board: 0x122e37, grid: 0x2b5f63, glow: 0x7ce8b0 },
    'magma-vein': { block: 0xff7a8f, board: 0x2d1230, grid: 0x63274f, glow: 0xffb27a },
    'aurora-field': { block: 0x6ad2ff, board: 0x14243f, grid: 0x2f4a75, glow: 0x9dffe0 },
    'void-garden': { block: 0xffd166, board: 0x241a3d, grid: 0x4b3a73, glow: 0xffe6a3 },
    singularity: { block: 0xff8ad0, board: 0x201436, grid: 0x4a2a6b, glow: 0xffa8e0 },
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
  private readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  // Pointer projection: the paddle plane is z = 0.34, where the paddle sits.
  private readonly raycaster = new THREE.Raycaster();
  private readonly paddlePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.34);
  private readonly pointerHit = new THREE.Vector3();
  private readonly pointerNdc = new THREE.Vector2();
  private readonly palette: (typeof THEME_PALETTES)[string];
  private readonly blockMesh: THREE.InstancedMesh;
  private readonly ballMesh: THREE.InstancedMesh;
  private readonly bonusMesh: THREE.InstancedMesh;
  private readonly paddle: THREE.Mesh;
  private readonly trailMesh: THREE.InstancedMesh | null = null;
  private readonly particleGeometry = new THREE.BufferGeometry();
  private readonly particlePoints: THREE.Points;
  private particles: Particle[] = [];
  private readonly trailHistory: THREE.Vector3[] = [];
  private readonly disposables: { dispose(): void }[] = [];

  private readonly tempMatrix = new THREE.Matrix4();
  private readonly tempPosition = new THREE.Vector3();
  private readonly tempScale = new THREE.Vector3();
  private readonly tempQuaternion = new THREE.Quaternion();
  private readonly tempColor = new THREE.Color();

  constructor(
    private readonly mount: HTMLElement,
    private readonly engine: TuğlaEngine,
    private quality: ResolvedQuality,
    private readonly levelStyle: LevelStyle = { theme: 'neon-grid', index: 1 },
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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.FogExp2(0x171034, 0.026);
    this.camera = new THREE.PerspectiveCamera();
    fitGameCamera(this.camera, {
      boardWidth: engine.width,
      boardHeight: engine.height,
      viewportWidth,
      viewportHeight,
    });

    this.buildLighting();
    this.buildBoard();

    const blockGeometry = new THREE.BoxGeometry(1, 1, 0.46, 1, 1, 1);
    const blockMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.24,
      metalness: 0.48,
      clearcoat: quality.level === 'LOW' ? 0 : 1,
      clearcoatRoughness: 0.18,
    });
    this.blockMesh = new THREE.InstancedMesh(
      blockGeometry,
      blockMaterial,
      Math.max(1, engine.snapshot.blocks.length),
    );
    this.blockMesh.castShadow = quality.shadows;
    this.blockMesh.receiveShadow = quality.shadows;
    this.blockMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.blockMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(Math.max(1, engine.snapshot.blocks.length) * 3),
      3,
    );
    this.scene.add(this.blockMesh);
    this.disposables.push(blockGeometry, blockMaterial);

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
    this.scene.add(this.bonusMesh);
    this.disposables.push(bonusGeometry, bonusMaterial);

    if (quality.trailLength > 0) {
      const trailGeometry = new THREE.SphereGeometry(1, 6, 4);
      const trailMaterial = new THREE.MeshBasicMaterial({
        color: 0xffd9c2,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      });
      this.trailMesh = new THREE.InstancedMesh(trailGeometry, trailMaterial, quality.trailLength);
      this.trailMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.trailMesh.frustumCulled = false;
      this.scene.add(this.trailMesh);
      this.disposables.push(trailGeometry, trailMaterial);
    }

    const paddleGeometry = new THREE.BoxGeometry(1, 1, 0.55);
    const paddleMaterial = new THREE.MeshPhysicalMaterial({
      color: paddleTone.color,
      emissive: paddleTone.emissive,
      emissiveIntensity: 0.8,
      metalness: 0.65,
      roughness: 0.18,
    });
    this.paddle = new THREE.Mesh(paddleGeometry, paddleMaterial);
    this.paddle.castShadow = quality.shadows;
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
    this.scene.add(this.particlePoints);
    this.disposables.push(this.particleGeometry, particleMaterial);

    this.applyBlockColors();
  }

  private buildLighting() {
    this.scene.add(new THREE.HemisphereLight(0xbaa6ff, 0x171034, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(-5, 16, 10);
    key.castShadow = this.quality.shadows;
    if (this.quality.shadows) {
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 40;
    }
    this.scene.add(key);
    const accent = new THREE.PointLight(this.palette.glow, 36, 30);
    accent.position.set(this.engine.width, 4, 5);
    this.scene.add(accent);
  }

  private buildBoard() {
    const geometry = new THREE.BoxGeometry(this.engine.width + 0.5, this.engine.height + 0.5, 0.35);
    const material = new THREE.MeshPhysicalMaterial({
      color: this.palette.board,
      roughness: 0.58,
      metalness: 0.42,
      clearcoat: this.quality.level === 'LOW' ? 0 : 0.7,
    });
    const board = new THREE.Mesh(geometry, material);
    board.position.set(this.engine.width / 2, this.engine.height / 2, -0.45);
    board.receiveShadow = this.quality.shadows;
    this.scene.add(board);
    this.disposables.push(geometry, material);

    const grid = new THREE.GridHelper(
      this.engine.height + 2,
      32,
      this.palette.grid,
      this.palette.board,
    );
    grid.rotation.x = Math.PI / 2;
    grid.position.set(this.engine.width / 2, this.engine.height / 2, -0.24);
    this.scene.add(grid);
  }

  private applyBlockColors() {
    this.engine.snapshot.blocks.forEach((block, index) => {
      this.tempColor.setHex(
        block.kind === 'NORMAL'
          ? this.palette.block
          : (BLOCK_COLORS[block.kind] ?? this.palette.block),
      );
      this.blockMesh.setColorAt(index, this.tempColor);
    });
    if (this.blockMesh.instanceColor) this.blockMesh.instanceColor.needsUpdate = true;
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
        count = Math.min(budget, this.quality.level === 'HIGH' ? 28 : 14);
        colour = 0xff7a8f;
        speed = 4.2;
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
      this.trailHistory.pop();
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

    snapshot.blocks.forEach((block, index) => {
      const visible = block.active;
      this.tempPosition.set(block.position.x, block.position.y, 0.1);
      this.tempScale.set(
        visible ? block.size.x * 0.92 : 0,
        visible ? block.size.y * 0.84 : 0,
        visible ? 1 : 0,
      );
      this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
      this.blockMesh.setMatrixAt(index, this.tempMatrix);
    });
    this.blockMesh.instanceMatrix.needsUpdate = true;

    const balls = snapshot.balls;
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

    const paddle = snapshot.paddle;
    this.paddle.position.set(paddle.x, paddle.y, 0.34);
    this.paddle.scale.set(paddle.width, paddle.height, 1);

    this.updateTrail(snapshot);
    this.updateParticles(delta);
    this.renderer.render(this.scene, this.camera);
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
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return this.engine.width / 2;

    const ndc = this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY ?? rect.top + rect.height * 0.85) - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.paddlePlane, this.pointerHit);
    if (!hit) return this.engine.width / 2;
    return hit.x;
  }

  get domElement() {
    return this.renderer.domElement;
  }

  dispose() {
    for (const item of this.disposables) item.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.mount) {
      this.mount.removeChild(this.renderer.domElement);
    }
  }
}
