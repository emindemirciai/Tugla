import {
  APP_DEFAULTS,
  encodeReplay,
  sessionChecksum,
  type BonusKind,
  type LevelDefinition,
  type ReplayDocument,
  type ReplayInput,
} from '@tugla/shared';
import type {
  Ball,
  EngineOptions,
  EngineSnapshot,
  FallingBonus,
  GameEvent,
  Paddle,
  RuntimeBlock,
  Vec2,
} from './types';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Duration of timed bonuses, expressed in physics ticks (120 Hz). */
const EFFECT_TICKS = {
  FIREBALL: 1440,
  PIERCING: 1200,
  EXPLOSIVE: 1200,
  CHAIN_LIGHTNING: 1200,
  GIANT_BALL: 1080,
  LASER: 960,
  PADDLE_GROW: 1800,
  MAGNET: 1440,
  SLOW_TIME: 720,
  STICKY: 1440,
  /** Five seconds of floor at 120 Hz. */
  SAFETY_NET: 600,
} as const;

const BASE_SPEED = 6.2;

/**
 * Ball speed is a property of the level, not a global constant: later worlds
 * play faster, boss rooms faster still, and a handful of levels per world are
 * deliberately "rush" levels. Derived from the level definition so the client
 * and the server's verification run always agree without extra payload.
 */
export const ballSpeedForLevel = (level: {
  world: number;
  index: number;
  type?: string;
}): number => {
  const worldRamp = 1 + Math.min(9, Math.max(0, level.world - 1)) * 0.035;
  const withinWorld = 1 + ((level.index - 1) % 50) * 0.0022;
  const boss = level.type === 'WORLD_BOSS' ? 1.12 : level.type === 'MINI_BOSS' ? 1.06 : 1;
  // Every seventh level is a sprint; the pattern is stable per level index.
  const rush = level.index % 7 === 3 ? 1.1 : 1;
  return Number((BASE_SPEED * worldRamp * withinWorld * boss * rush).toFixed(4));
};
const MIN_SPEED = 5.6;
const MAX_SPEED = 9.4;
const REGEN_TICKS = 900;
const SHIELD_TICKS = 240;
const BONUS_FALL_SPEED = 2.15;
const MAX_LAUNCH_ANGLE = 1.05;

const circleAabb = (ball: Ball, block: RuntimeBlock) => {
  const halfWidth = block.size.x / 2;
  const halfHeight = block.size.y / 2;
  const nearestX = clamp(
    ball.position.x,
    block.position.x - halfWidth,
    block.position.x + halfWidth,
  );
  const nearestY = clamp(
    ball.position.y,
    block.position.y - halfHeight,
    block.position.y + halfHeight,
  );
  const dx = ball.position.x - nearestX;
  const dy = ball.position.y - nearestY;
  return dx * dx + dy * dy <= ball.radius * ball.radius;
};

/**
 * Deterministic 2D brick-breaker simulation.
 *
 * Determinism guarantees, which the anti-cheat and replay systems depend on:
 * - fixed timestep integration only (variable frame time is accumulated, never integrated),
 * - a seeded PRNG that is the sole source of randomness,
 * - integer tick counter used for every timed effect,
 * - inputs applied at tick boundaries and recorded in order.
 *
 * Given the same seed, level and input list, two runs produce identical results
 * on any machine, which is what lets the server verify a reported score.
 */
export class TuğlaEngine {
  readonly width: number;
  readonly height: number;
  readonly fixedStep: number;
  readonly maxBalls: number;
  readonly seed: number;
  readonly levelId: string;

  private accumulator = 0;
  private nextBallId = 1;
  private nextBonusId = 1;
  private events: GameEvent[] = [];
  private randomState: number;
  private readonly initialLives: number;
  /** Per-level ball speed; see ballSpeedForLevel. */
  readonly ballSpeed: number;
  private readonly recordReplay: boolean;
  private readonly inputs: ReplayInput[] = [];
  private pendingLaunch = false;

  snapshot: EngineSnapshot;

  constructor(level: LevelDefinition, options: EngineOptions = {}) {
    this.width = options.width ?? 9;
    this.height = options.height ?? 16;
    this.fixedStep = options.fixedStep ?? 1 / 120;
    this.maxBalls = options.maxBalls ?? APP_DEFAULTS.maxBalls;
    this.seed = options.seed ?? level.seed ?? 1;
    this.levelId = options.levelId ?? `${level.world}-${level.index}`;
    this.randomState = this.seed || 1;
    this.initialLives = options.lives ?? APP_DEFAULTS.livesPerLevel;
    this.ballSpeed = ballSpeedForLevel(level);
    this.recordReplay = options.recordReplay ?? true;

    const paddle: Paddle = {
      x: this.width / 2,
      y: 0.7,
      width: 1.8,
      baseWidth: 1.8,
      height: 0.22,
      targetX: this.width / 2,
      shield: 0,
      growTicks: 0,
      magnetTicks: 0,
      stickyTicks: 0,
      laserTicks: 0,
    };

    this.snapshot = {
      tick: 0,
      score: 0,
      combo: 0,
      bestCombo: 0,
      lives: this.initialLives,
      balls: [this.makeBall(paddle.x, paddle.y + 0.35, 0, 0)],
      blocks: level.blocks.map((block) => this.makeBlock(block)),
      bonuses: [],
      paddle,
      status: 'READY',
      overcharge: 1,
      safetyNetTicks: 0,
      blocksDestroyed: 0,
      maxBallsReached: 1,
      bossDefeated: false,
    };
  }

  private makeBlock(block: LevelDefinition['blocks'][number]): RuntimeBlock {
    const position: Vec2 = { x: block.x * this.width, y: block.y * this.height };
    return {
      id: block.id,
      kind: block.kind,
      position: { ...position },
      origin: { ...position },
      size: { x: block.width * this.width, y: block.height * this.height },
      hitPoints: block.hitPoints,
      maxHitPoints: block.hitPoints,
      required: block.required,
      bonus: block.bonus ?? null,
      active: true,
      shieldTicks: block.kind === 'SHIELDED' ? SHIELD_TICKS : 0,
      regenTicks: 0,
      motionRange: (block.motionRange ?? (block.kind === 'MOVING' ? 0.12 : 0)) * this.width,
      motionSpeed: block.motionSpeed ?? (block.kind === 'MOVING' ? 0.9 : 0),
      motionPhase: (block.x + block.y) * Math.PI,
    };
  }

  private makeBall(x: number, y: number, velocityX: number, velocityY: number): Ball {
    return {
      id: this.nextBallId++,
      position: { x, y },
      previous: { x, y },
      velocity: { x: velocityX, y: velocityY },
      radius: 0.105,
      damage: 1,
      active: true,
      effects: new Map(),
      stuckOffset: null,
    };
  }

  /** xorshift-based PRNG: deterministic, no dependency on Math.random. */
  private random() {
    this.randomState |= 0;
    this.randomState = (this.randomState + 0x6d2b79f5) | 0;
    let value = Math.imul(this.randomState ^ (this.randomState >>> 15), 1 | this.randomState);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  private record(kind: ReplayInput['k'], value: number) {
    if (!this.recordReplay) return;
    if (this.inputs.length >= 20000) return;

    const quantised = Number(value.toFixed(4));
    const last = this.inputs.at(-1);

    // A pointer fires many moves between two ticks, and the replay applies them
    // in order at the same tick — so only the last one can matter. Overwriting
    // instead of appending keeps the payload proportional to game length rather
    // than to how fast the device samples the pointer, which is what pushed long
    // games past the request size limit.
    if (last && last.t === this.snapshot.tick && last.k === kind) {
      last.v = quantised;
      return;
    }
    // An unchanged target is a no-op for the simulation; recording it only makes
    // the replay bigger.
    if (last && last.k === kind && last.v === quantised && kind === 'm') return;

    this.inputs.push({ t: this.snapshot.tick, k: kind, v: quantised });
  }

  // ----- public control surface -------------------------------------------------

  setPaddleTarget(x: number, options: { record?: boolean } = {}) {
    const clamped = clamp(
      x,
      this.snapshot.paddle.width / 2,
      this.width - this.snapshot.paddle.width / 2,
    );
    // Quantise before applying, not only before recording.
    //
    // The replay stores four decimals, so a live run that steered with full
    // double precision integrated a slightly different paddle position than the
    // verification run. In a system this chaotic that tiny gap compounds over
    // thousands of ticks into a different board — which is why honest players
    // were being rejected with replay-score-mismatch. Live play and replay must
    // see the exact same number.
    const quantised = Number(clamped.toFixed(4));
    if (options.record !== false) this.record('m', quantised);
    this.snapshot.paddle.targetX = quantised;
  }

  /**
   * Launches the ball. The horizontal component comes from how the player was
   * moving the paddle, so the first shot is aimed with paddle motion.
   */
  launch(options: { record?: boolean } = {}) {
    if (this.snapshot.status !== 'READY' && this.snapshot.status !== 'RUNNING') return;
    if (options.record !== false) this.record('l', 0);
    const drift = clamp((this.snapshot.paddle.targetX - this.snapshot.paddle.x) * 1.8, -3.7, 3.7);
    let launched = false;
    for (const ball of this.snapshot.balls) {
      if (ball.stuckOffset === null && this.snapshot.status === 'RUNNING') continue;
      const angleBias = Math.abs(drift) < 0.35 ? (this.random() - 0.5) * 1.2 : drift;
      ball.velocity.x = angleBias;
      ball.velocity.y = this.ballSpeed;
      ball.stuckOffset = null;
      launched = true;
    }
    if (launched) this.snapshot.status = 'RUNNING';
    this.pendingLaunch = false;
  }

  pause(paused: boolean) {
    if (paused && this.snapshot.status === 'RUNNING') this.snapshot.status = 'PAUSED';
    else if (!paused && this.snapshot.status === 'PAUSED') this.snapshot.status = 'RUNNING';
  }

  /**
   * Adds balls up to the cap. Once the cap is reached the surplus is converted
   * into permanent Overcharge damage instead of being silently discarded.
   */
  addBalls(count: number) {
    const source = this.snapshot.balls.find((ball) => ball.active) ?? this.snapshot.balls[0];
    if (!source) return 0;
    const activeCount = this.snapshot.balls.filter((ball) => ball.active).length;
    const capacity = Math.max(0, this.maxBalls - activeCount);
    const spawned = Math.max(0, Math.min(count, capacity));

    for (let index = 0; index < spawned; index += 1) {
      const angle = (this.random() - 0.5) * 1.4;
      const speed = Math.hypot(source.velocity.x, source.velocity.y) || this.ballSpeed;
      const ball = this.makeBall(
        source.position.x,
        source.position.y,
        Math.sin(angle) * speed,
        Math.abs(Math.cos(angle) * speed) || speed,
      );
      for (const [effect, ticks] of source.effects) ball.effects.set(effect, ticks);
      ball.damage = source.damage;
      this.snapshot.balls.push(ball);
      this.events.push({
        tick: this.snapshot.tick,
        type: 'BALL_SPAWNED',
        entityId: ball.id,
        x: ball.position.x,
        y: ball.position.y,
      });
    }

    const overflow = count - spawned;
    if (overflow > 0) this.applyOvercharge(overflow);

    this.snapshot.maxBallsReached = Math.max(
      this.snapshot.maxBallsReached,
      this.snapshot.balls.filter((ball) => ball.active).length,
    );
    return spawned;
  }

  /**
   * Overcharge: at the 500-ball cap, further ball bonuses raise a global damage
   * multiplier instead. It is capped so it cannot grow without bound.
   */
  private applyOvercharge(overflow: number) {
    const before = this.snapshot.overcharge;
    this.snapshot.overcharge = Math.min(8, this.snapshot.overcharge + overflow * 0.05);
    if (this.snapshot.overcharge > before) {
      this.events.push({
        tick: this.snapshot.tick,
        type: 'OVERCHARGE',
        value: this.snapshot.overcharge,
      });
    }
  }

  collectBonus(kind: BonusKind, options: { record?: boolean } = {}) {
    if (options.record !== false) this.record('b', 0);
    this.events.push({ tick: this.snapshot.tick, type: 'BONUS_COLLECTED', entityId: kind });
    const paddle = this.snapshot.paddle;
    switch (kind) {
      case 'BALL_1':
        this.addBalls(1);
        break;
      case 'BALL_3':
        this.addBalls(3);
        break;
      case 'BALL_5':
        this.addBalls(5);
        break;
      case 'BALL_DOUBLE':
        this.addBalls(this.snapshot.balls.filter((ball) => ball.active).length);
        break;
      case 'PADDLE_GROW':
        paddle.growTicks = EFFECT_TICKS.PADDLE_GROW;
        paddle.width = Math.min(paddle.baseWidth * 1.9, paddle.width + 0.45);
        break;
      case 'MAGNET':
        paddle.magnetTicks = EFFECT_TICKS.MAGNET;
        break;
      case 'STICKY':
        paddle.stickyTicks = EFFECT_TICKS.STICKY;
        break;
      case 'LASER':
        paddle.laserTicks = EFFECT_TICKS.LASER;
        break;
      case 'SHIELD':
        paddle.shield = 1;
        break;
      case 'SAFETY_NET':
        // A floor across the whole board for five seconds: balls bounce back up
        // instead of being lost, so a busy board cannot wipe a life in one go.
        this.snapshot.safetyNetTicks = EFFECT_TICKS.SAFETY_NET;
        break;
      case 'LIFE_GUARD':
        this.snapshot.lives = Math.min(APP_DEFAULTS.livesPerLevel, this.snapshot.lives + 1);
        break;
      case 'GIANT_BALL':
        for (const ball of this.snapshot.balls) {
          ball.effects.set('GIANT_BALL', EFFECT_TICKS.GIANT_BALL);
          ball.radius = 0.19;
        }
        break;
      case 'SLOW_TIME':
        for (const ball of this.snapshot.balls)
          ball.effects.set('SLOW_TIME', EFFECT_TICKS.SLOW_TIME);
        break;
      default:
        for (const ball of this.snapshot.balls) {
          ball.effects.set(kind, EFFECT_TICKS[kind as keyof typeof EFFECT_TICKS] ?? 1200);
        }
        break;
    }
  }

  // ----- simulation -------------------------------------------------------------

  update(deltaSeconds: number) {
    if (this.snapshot.status === 'COMPLETED' || this.snapshot.status === 'FAILED') return;
    if (this.snapshot.status === 'PAUSED') return;
    this.accumulator = Math.min(this.accumulator + deltaSeconds, 0.25);
    while (this.accumulator >= this.fixedStep) {
      this.step(this.fixedStep);
      this.accumulator -= this.fixedStep;
    }
  }

  /** Advances exactly one fixed tick — the only place physics integrates. */
  step(dt: number = this.fixedStep) {
    this.snapshot.tick += 1;
    this.movePaddle(dt);
    this.updateTimers();
    this.moveBlocks();

    if (this.snapshot.status === 'READY') {
      const ball = this.snapshot.balls[0];
      if (ball) {
        ball.position.x = this.snapshot.paddle.x;
        ball.position.y = this.snapshot.paddle.y + 0.35;
        ball.previous.x = ball.position.x;
        ball.previous.y = ball.position.y;
      }
      this.updateBonuses(dt);
      if (this.pendingLaunch) this.launch({ record: false });
      return;
    }
    if (this.snapshot.status !== 'RUNNING') return;

    for (const ball of this.snapshot.balls) {
      if (!ball.active) continue;
      if (ball.stuckOffset !== null) {
        ball.position.x = clamp(
          this.snapshot.paddle.x + ball.stuckOffset,
          ball.radius,
          this.width - ball.radius,
        );
        ball.position.y = this.snapshot.paddle.y + this.snapshot.paddle.height / 2 + ball.radius;
        continue;
      }
      const scale = ball.effects.has('SLOW_TIME') ? 0.55 : 1;
      ball.previous.x = ball.position.x;
      ball.previous.y = ball.position.y;
      ball.position.x += ball.velocity.x * dt * scale;
      ball.position.y += ball.velocity.y * dt * scale;
      this.collideBounds(ball);
      this.collidePaddle(ball);
      this.collideBlocks(ball);
      if (ball.position.y < -0.5) this.retireBall(ball);
    }

    this.updateBonuses(dt);
    this.snapshot.balls = this.snapshot.balls.filter((ball) => ball.active);

    if (this.snapshot.balls.length === 0) this.loseLife();
    else if (this.isCleared()) this.completeLevel();
  }

  private isCleared() {
    return this.snapshot.blocks.every(
      (block) => !block.required || (!block.active && block.regenTicks <= 0),
    );
  }

  private completeLevel() {
    this.snapshot.status = 'COMPLETED';
    this.snapshot.score += this.snapshot.lives * 1000;
    this.events.push({
      tick: this.snapshot.tick,
      type: 'LEVEL_COMPLETED',
      value: this.snapshot.score,
    });
  }

  private movePaddle(dt: number) {
    const paddle = this.snapshot.paddle;
    const distance = paddle.targetX - paddle.x;
    paddle.x += distance * Math.min(1, dt * 18);
    paddle.x = clamp(paddle.x, paddle.width / 2, this.width - paddle.width / 2);
  }

  private updateTimers() {
    const paddle = this.snapshot.paddle;
    if (paddle.growTicks > 0 && --paddle.growTicks === 0) paddle.width = paddle.baseWidth;
    if (paddle.magnetTicks > 0) paddle.magnetTicks -= 1;
    if (paddle.stickyTicks > 0) paddle.stickyTicks -= 1;
    if (paddle.laserTicks > 0) paddle.laserTicks -= 1;
    if (this.snapshot.safetyNetTicks > 0) this.snapshot.safetyNetTicks -= 1;

    for (const ball of this.snapshot.balls) {
      for (const [effect, ticks] of ball.effects) {
        if (ticks <= 1) {
          ball.effects.delete(effect);
          if (effect === 'GIANT_BALL') ball.radius = 0.105;
        } else ball.effects.set(effect, ticks - 1);
      }
    }

    for (const block of this.snapshot.blocks) {
      if (block.shieldTicks > 0) block.shieldTicks -= 1;
      if (!block.active && block.regenTicks > 0 && --block.regenTicks === 0) {
        block.active = true;
        block.hitPoints = block.maxHitPoints;
        this.events.push({
          tick: this.snapshot.tick,
          type: 'BLOCK_REGENERATED',
          entityId: block.id,
          x: block.position.x,
          y: block.position.y,
        });
      }
    }
  }

  private moveBlocks() {
    if (this.snapshot.tick % 2 !== 0) return;
    for (const block of this.snapshot.blocks) {
      if (block.kind !== 'MOVING' || block.motionRange <= 0) continue;
      const t = this.snapshot.tick * this.fixedStep * block.motionSpeed + block.motionPhase;
      block.position.x = clamp(
        block.origin.x + Math.sin(t) * block.motionRange,
        block.size.x / 2,
        this.width - block.size.x / 2,
      );
    }
  }

  private updateBonuses(dt: number) {
    const paddle = this.snapshot.paddle;
    for (const bonus of this.snapshot.bonuses) {
      if (!bonus.active) continue;
      bonus.position.y -= BONUS_FALL_SPEED * dt;
      const withinX = Math.abs(bonus.position.x - paddle.x) <= paddle.width / 2 + 0.22;
      const withinY =
        bonus.position.y <= paddle.y + paddle.height / 2 + 0.25 &&
        bonus.position.y >= paddle.y - paddle.height;
      if (withinX && withinY) {
        bonus.active = false;
        this.collectBonus(bonus.kind, { record: false });
      } else if (bonus.position.y < -0.6) {
        bonus.active = false;
      }
    }
    this.snapshot.bonuses = this.snapshot.bonuses.filter((bonus) => bonus.active);
  }

  private retireBall(ball: Ball) {
    if (this.snapshot.safetyNetTicks > 0) {
      ball.position.y = 0.22;
      ball.velocity.y = Math.abs(ball.velocity.y) || this.ballSpeed;
      this.events.push({ tick: this.snapshot.tick, type: 'SAFETY_NET_BOUNCE', entityId: ball.id });
      return;
    }
    if (
      this.snapshot.paddle.shield > 0 &&
      this.snapshot.balls.filter((b) => b.active).length === 1
    ) {
      this.snapshot.paddle.shield = 0;
      ball.position.y = this.snapshot.paddle.y + 0.4;
      ball.velocity.y = Math.abs(ball.velocity.y) || this.ballSpeed;
      this.events.push({ tick: this.snapshot.tick, type: 'SHIELD_ABSORBED' });
      return;
    }
    ball.active = false;
    this.events.push({
      tick: this.snapshot.tick,
      type: 'BALL_LOST',
      entityId: ball.id,
      x: ball.position.x,
      y: ball.position.y,
    });
  }

  private collideBounds(ball: Ball) {
    if (ball.position.x - ball.radius <= 0 && ball.velocity.x < 0) {
      ball.position.x = ball.radius;
      ball.velocity.x *= -1;
    }
    if (ball.position.x + ball.radius >= this.width && ball.velocity.x > 0) {
      ball.position.x = this.width - ball.radius;
      ball.velocity.x *= -1;
    }
    if (ball.position.y + ball.radius >= this.height && ball.velocity.y > 0) {
      ball.position.y = this.height - ball.radius;
      ball.velocity.y *= -1;
    }
  }

  /**
   * Paddle bounce angle depends on where the ball lands: centre sends it
   * straight up, the edges deflect up to ~60 degrees.
   */
  private collidePaddle(ball: Ball) {
    const paddle = this.snapshot.paddle;
    if (ball.velocity.y >= 0) return;
    const withinY =
      ball.position.y - ball.radius <= paddle.y + paddle.height / 2 &&
      ball.position.y + ball.radius >= paddle.y - paddle.height / 2;
    const withinX = Math.abs(ball.position.x - paddle.x) <= paddle.width / 2 + ball.radius;
    if (!withinY || !withinX) return;

    ball.position.y = paddle.y + paddle.height / 2 + ball.radius;
    const impact = clamp((ball.position.x - paddle.x) / (paddle.width / 2), -1, 1);
    const speed = clamp(Math.hypot(ball.velocity.x, ball.velocity.y) * 1.01, MIN_SPEED, MAX_SPEED);
    const angle = impact * MAX_LAUNCH_ANGLE;
    ball.velocity.x = Math.sin(angle) * speed;
    ball.velocity.y = Math.max(2.2, Math.cos(angle) * speed);
    this.snapshot.combo = 0;

    if (paddle.stickyTicks > 0) {
      ball.stuckOffset = ball.position.x - paddle.x;
      this.pendingLaunch = false;
    }
    this.events.push({
      tick: this.snapshot.tick,
      type: 'PADDLE_HIT',
      entityId: ball.id,
      value: impact,
      x: ball.position.x,
      y: ball.position.y,
    });
  }

  private collideBlocks(ball: Ball) {
    for (const block of this.snapshot.blocks) {
      if (!block.active || !circleAabb(ball, block)) continue;

      if (block.kind === 'DEFLECTOR') {
        this.reflect(ball, block);
        this.events.push({
          tick: this.snapshot.tick,
          type: 'BLOCK_HIT',
          entityId: block.id,
          value: block.hitPoints,
        });
        return;
      }

      if (block.kind === 'ABSORBER') {
        ball.velocity.x *= 0.72;
        ball.velocity.y *= 0.72;
        const speed = Math.hypot(ball.velocity.x, ball.velocity.y);
        if (speed < MIN_SPEED) {
          const scale = MIN_SPEED / (speed || 1);
          ball.velocity.x *= scale;
          ball.velocity.y *= scale;
        }
        this.reflect(ball, block);
        return;
      }

      const piercing = ball.effects.has('PIERCING') || ball.effects.has('FIREBALL');
      if (!piercing) this.reflect(ball, block);

      if (block.kind === 'SHIELDED' && block.shieldTicks > 0) {
        this.events.push({ tick: this.snapshot.tick, type: 'SHIELD_ABSORBED', entityId: block.id });
        return;
      }

      if (block.kind === 'PORTAL') {
        const target = this.pickPortalTarget(block);
        if (target) {
          ball.position.x = target.position.x;
          ball.position.y = target.position.y - target.size.y;
        }
      }

      this.damageBlock(block, this.damageFor(ball, block), ball);

      if (ball.effects.has('SPLITTER_SOURCE' as BonusKind)) {
        // reserved: splitter handled on block destruction
      }
      if (!piercing) return;
    }
  }

  private pickPortalTarget(source: RuntimeBlock) {
    const portals = this.snapshot.blocks.filter(
      (block) => block.kind === 'PORTAL' && block.active && block.id !== source.id,
    );
    if (!portals.length) return null;
    return portals[Math.floor(this.random() * portals.length)] ?? null;
  }

  private reflect(ball: Ball, block: RuntimeBlock) {
    const dx = ball.position.x - block.position.x;
    const dy = ball.position.y - block.position.y;
    const overlapX = block.size.x / 2 + ball.radius - Math.abs(dx);
    const overlapY = block.size.y / 2 + ball.radius - Math.abs(dy);
    if (overlapX < overlapY) {
      ball.velocity.x *= -1;
      ball.position.x += Math.sign(dx || 1) * overlapX;
    } else {
      ball.velocity.y *= -1;
      ball.position.y += Math.sign(dy || 1) * overlapY;
    }
  }

  private damageFor(ball: Ball, block: RuntimeBlock) {
    let damage = ball.damage * this.snapshot.overcharge;
    if (ball.effects.has('FIREBALL')) damage *= 2.4;
    if (block.kind === 'ICE' && ball.effects.has('FIREBALL')) damage *= 1.8;
    if (block.kind === 'ARMORED' && !ball.effects.has('PIERCING')) damage *= 0.6;
    if (block.kind === 'BOSS_CORE') damage *= 1;
    return Math.max(0.2, damage);
  }

  private damageBlock(block: RuntimeBlock, damage: number, ball: Ball) {
    block.hitPoints -= damage;
    this.snapshot.combo += 1;
    this.snapshot.bestCombo = Math.max(this.snapshot.bestCombo, this.snapshot.combo);
    this.snapshot.score += Math.round(100 * this.comboMultiplier());

    this.events.push({
      tick: this.snapshot.tick,
      type: block.kind === 'BOSS_CORE' ? 'BOSS_DAMAGED' : 'BLOCK_HIT',
      entityId: block.id,
      value: Math.max(0, block.hitPoints),
      x: block.position.x,
      y: block.position.y,
    });

    if (block.hitPoints > 0) return;
    this.destroyBlock(block, ball);
  }

  private destroyBlock(block: RuntimeBlock, ball: Ball) {
    block.active = false;
    block.hitPoints = 0;
    this.snapshot.blocksDestroyed += 1;
    this.snapshot.score += 250;

    this.events.push({
      tick: this.snapshot.tick,
      type: 'BLOCK_DESTROYED',
      entityId: block.id,
      x: block.position.x,
      y: block.position.y,
    });

    if (block.kind === 'BOSS_CORE') {
      this.snapshot.bossDefeated = true;
      this.snapshot.score += 5000;
      this.events.push({ tick: this.snapshot.tick, type: 'BOSS_DEFEATED', entityId: block.id });
    }

    if (block.kind === 'REGENERATING') block.regenTicks = REGEN_TICKS;

    if (block.kind === 'EXPLOSIVE' || ball.effects.has('EXPLOSIVE')) {
      this.explode(block, ball);
    }

    if (block.kind === 'ELECTRIC' || ball.effects.has('CHAIN_LIGHTNING')) {
      this.chain(block, ball);
    }

    if (block.kind === 'SPLITTER') this.addBalls(2);

    if (block.bonus) this.dropBonus(block);
  }

  private explode(source: RuntimeBlock, ball: Ball) {
    const radius = Math.max(source.size.x, source.size.y) * 2.1;
    this.events.push({
      tick: this.snapshot.tick,
      type: 'BLOCK_EXPLODED',
      entityId: source.id,
      value: radius,
      x: source.position.x,
      y: source.position.y,
    });
    for (const block of this.snapshot.blocks) {
      if (!block.active || block.id === source.id) continue;
      const distance = Math.hypot(
        block.position.x - source.position.x,
        block.position.y - source.position.y,
      );
      if (distance > radius) continue;
      block.hitPoints -= 2 * this.snapshot.overcharge;
      if (block.hitPoints <= 0) this.destroyBlock(block, ball);
    }
  }

  private chain(source: RuntimeBlock, ball: Ball) {
    const candidates = this.snapshot.blocks
      .filter((block) => block.active && block.id !== source.id)
      .map((block) => ({
        block,
        distance: Math.hypot(
          block.position.x - source.position.x,
          block.position.y - source.position.y,
        ),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
    for (const { block } of candidates) {
      block.hitPoints -= 1 * this.snapshot.overcharge;
      this.events.push({
        tick: this.snapshot.tick,
        type: 'BLOCK_HIT',
        entityId: block.id,
        value: Math.max(0, block.hitPoints),
        x: block.position.x,
        y: block.position.y,
      });
      if (block.hitPoints <= 0) this.destroyBlock(block, ball);
    }
  }

  private dropBonus(block: RuntimeBlock) {
    if (!block.bonus) return;
    const bonus: FallingBonus = {
      id: this.nextBonusId++,
      kind: block.bonus,
      position: { x: block.position.x, y: block.position.y },
      velocityY: -BONUS_FALL_SPEED,
      active: true,
    };
    this.snapshot.bonuses.push(bonus);
    this.events.push({
      tick: this.snapshot.tick,
      type: 'BONUS_DROPPED',
      entityId: bonus.id,
      x: bonus.position.x,
      y: bonus.position.y,
    });
  }

  private comboMultiplier() {
    return Math.min(8, Math.max(1, Math.floor(this.snapshot.combo / 5) + 1));
  }

  private loseLife() {
    this.snapshot.lives -= 1;
    this.snapshot.combo = 0;
    this.snapshot.overcharge = 1;
    this.events.push({ tick: this.snapshot.tick, type: 'LIFE_LOST', value: this.snapshot.lives });
    if (this.snapshot.lives <= 0) {
      this.snapshot.status = 'FAILED';
      this.events.push({ tick: this.snapshot.tick, type: 'GAME_OVER' });
      return;
    }
    const paddle = this.snapshot.paddle;
    paddle.width = paddle.baseWidth;
    paddle.growTicks = 0;
    paddle.stickyTicks = 0;
    paddle.magnetTicks = 0;
    this.snapshot.bonuses = [];
    this.snapshot.balls = [this.makeBall(paddle.x, paddle.y + 0.35, 0, 0)];
    this.snapshot.status = 'READY';
  }

  // ----- reporting --------------------------------------------------------------

  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  get eventCount() {
    return this.snapshot.tick;
  }

  toReplay(): ReplayDocument {
    return {
      version: 1,
      seed: this.seed,
      levelId: this.levelId.slice(0, 64),
      width: this.width,
      height: this.height,
      fixedStep: this.fixedStep,
      maxBalls: this.maxBalls,
      lives: this.initialLives,
      inputs: this.inputs,
      finalTick: this.snapshot.tick,
      score: this.snapshot.score,
    };
  }

  encodeReplay() {
    return encodeReplay(this.toReplay());
  }

  /** Builds the signed result payload the API expects at session completion. */
  buildResult(session: { sessionId: string; nonce: string }) {
    const payload = {
      sessionId: session.sessionId,
      score: this.snapshot.score,
      durationMs: Math.max(1, Math.round(this.snapshot.tick * this.fixedStep * 1000)),
      livesRemaining: Math.max(0, this.snapshot.lives),
      maxBalls: this.snapshot.maxBallsReached,
      blocksDestroyed: this.snapshot.blocksDestroyed,
      bossDefeated: this.snapshot.bossDefeated,
      completed: this.snapshot.status === 'COMPLETED',
      eventCount: this.snapshot.tick,
      finalTick: this.snapshot.tick,
    };
    return {
      ...payload,
      checksum: sessionChecksum({
        sessionId: session.sessionId,
        nonce: session.nonce,
        seed: this.seed,
        score: payload.score,
        durationMs: payload.durationMs,
        blocksDestroyed: payload.blocksDestroyed,
        eventCount: payload.eventCount,
        finalTick: payload.finalTick,
        livesRemaining: payload.livesRemaining,
        maxBalls: payload.maxBalls,
      }),
      replay: this.encodeReplay(),
    };
  }
}
