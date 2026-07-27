import type { BlockKind, BonusKind, LevelDefinition } from '@pulse/shared';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Ball {
  id: number;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  damage: number;
  active: boolean;
  effects: Set<BonusKind>;
}

export interface RuntimeBlock {
  id: string;
  kind: BlockKind;
  position: Vec2;
  size: Vec2;
  hitPoints: number;
  maxHitPoints: number;
  required: boolean;
  bonus?: BonusKind | null;
  active: boolean;
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  targetX: number;
  shield: number;
}

export interface GameEvent {
  tick: number;
  type:
    | 'BALL_LOST'
    | 'BLOCK_HIT'
    | 'BLOCK_DESTROYED'
    | 'BONUS_DROPPED'
    | 'LIFE_LOST'
    | 'LEVEL_COMPLETED'
    | 'GAME_OVER';
  entityId?: string | number;
  value?: number;
}

export interface EngineSnapshot {
  tick: number;
  score: number;
  combo: number;
  lives: number;
  balls: Ball[];
  blocks: RuntimeBlock[];
  paddle: Paddle;
  status: 'READY' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
}

export interface EngineOptions {
  width?: number;
  height?: number;
  lives?: number;
  maxBalls?: number;
  fixedStep?: number;
  seed?: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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

export class PulseEngine {
  readonly width: number;
  readonly height: number;
  readonly fixedStep: number;
  readonly maxBalls: number;
  private accumulator = 0;
  private nextBallId = 1;
  private events: GameEvent[] = [];
  private randomState: number;
  snapshot: EngineSnapshot;

  constructor(level: LevelDefinition, options: EngineOptions = {}) {
    this.width = options.width ?? 9;
    this.height = options.height ?? 16;
    this.fixedStep = options.fixedStep ?? 1 / 120;
    this.maxBalls = options.maxBalls ?? 500;
    this.randomState = options.seed ?? level.seed ?? 1;
    const paddle: Paddle = {
      x: this.width / 2,
      y: 0.7,
      width: 1.8,
      height: 0.22,
      targetX: this.width / 2,
      shield: 100,
    };
    this.snapshot = {
      tick: 0,
      score: 0,
      combo: 0,
      lives: options.lives ?? 5,
      balls: [this.makeBall(paddle.x, paddle.y + 0.35, 0, 0)],
      blocks: level.blocks.map((block) => ({
        id: block.id,
        kind: block.kind,
        position: { x: block.x * this.width, y: block.y * this.height },
        size: { x: block.width * this.width, y: block.height * this.height },
        hitPoints: block.hitPoints,
        maxHitPoints: block.hitPoints,
        required: block.required,
        bonus: block.bonus,
        active: true,
      })),
      paddle,
      status: 'READY',
    };
  }

  private makeBall(x: number, y: number, velocityX: number, velocityY: number): Ball {
    return {
      id: this.nextBallId++,
      position: { x, y },
      velocity: { x: velocityX, y: velocityY },
      radius: 0.105,
      damage: 1,
      active: true,
      effects: new Set(),
    };
  }

  private random() {
    this.randomState |= 0;
    this.randomState = (this.randomState + 0x6d2b79f5) | 0;
    let value = Math.imul(this.randomState ^ (this.randomState >>> 15), 1 | this.randomState);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  setPaddleTarget(x: number) {
    this.snapshot.paddle.targetX = clamp(
      x,
      this.snapshot.paddle.width / 2,
      this.width - this.snapshot.paddle.width / 2,
    );
  }

  launch() {
    if (this.snapshot.status !== 'READY') return;
    const direction = clamp(
      (this.snapshot.paddle.targetX - this.snapshot.paddle.x) * 1.8,
      -3.7,
      3.7,
    );
    const ball = this.snapshot.balls[0];
    if (!ball) return;
    ball.velocity.x = Math.abs(direction) < 0.35 ? (this.random() - 0.5) * 1.2 : direction;
    ball.velocity.y = 6.2;
    this.snapshot.status = 'RUNNING';
  }

  pause(paused: boolean) {
    if (paused && this.snapshot.status === 'RUNNING') this.snapshot.status = 'PAUSED';
    if (!paused && this.snapshot.status === 'PAUSED') this.snapshot.status = 'RUNNING';
  }

  addBalls(count: number) {
    const source = this.snapshot.balls.find((ball) => ball.active);
    if (!source) return 0;
    const capacity = this.maxBalls - this.snapshot.balls.filter((ball) => ball.active).length;
    const amount = Math.max(0, Math.min(count, capacity));
    for (let index = 0; index < amount; index += 1) {
      const angle = (this.random() - 0.5) * 0.8;
      const speed = Math.hypot(source.velocity.x, source.velocity.y) || 6.2;
      this.snapshot.balls.push(
        this.makeBall(
          source.position.x,
          source.position.y,
          Math.sin(angle) * speed,
          Math.abs(Math.cos(angle) * speed),
        ),
      );
    }
    if (count > amount) {
      for (const ball of this.snapshot.balls) ball.damage = Math.min(5, ball.damage + 0.1);
    }
    return amount;
  }

  update(deltaSeconds: number) {
    if (this.snapshot.status === 'READY') {
      const ball = this.snapshot.balls[0];
      if (ball) {
        ball.position.x = this.snapshot.paddle.x;
        ball.position.y = this.snapshot.paddle.y + 0.35;
      }
      this.movePaddle(deltaSeconds);
      return;
    }
    if (this.snapshot.status !== 'RUNNING') return;
    this.accumulator = Math.min(this.accumulator + deltaSeconds, 0.1);
    while (this.accumulator >= this.fixedStep) {
      this.step(this.fixedStep);
      this.accumulator -= this.fixedStep;
    }
  }

  private movePaddle(dt: number) {
    const paddle = this.snapshot.paddle;
    const distance = paddle.targetX - paddle.x;
    paddle.x += distance * Math.min(1, dt * 18);
  }

  private step(dt: number) {
    this.snapshot.tick += 1;
    this.movePaddle(dt);
    const activeBalls = this.snapshot.balls.filter((ball) => ball.active);
    for (const ball of activeBalls) {
      ball.position.x += ball.velocity.x * dt;
      ball.position.y += ball.velocity.y * dt;
      this.collideBounds(ball);
      this.collidePaddle(ball);
      this.collideBlocks(ball);
      if (ball.position.y < -0.5) {
        ball.active = false;
        this.events.push({ tick: this.snapshot.tick, type: 'BALL_LOST', entityId: ball.id });
      }
    }
    this.snapshot.balls = this.snapshot.balls.filter((ball) => ball.active);
    if (this.snapshot.balls.length === 0) this.loseLife();
    if (
      this.snapshot.blocks.every((block) => !block.active || !block.required) &&
      this.snapshot.status === 'RUNNING'
    ) {
      this.snapshot.status = 'COMPLETED';
      this.events.push({ tick: this.snapshot.tick, type: 'LEVEL_COMPLETED' });
    }
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

  private collidePaddle(ball: Ball) {
    const paddle = this.snapshot.paddle;
    if (
      ball.velocity.y < 0 &&
      ball.position.y - ball.radius <= paddle.y + paddle.height / 2 &&
      ball.position.y + ball.radius >= paddle.y - paddle.height / 2 &&
      Math.abs(ball.position.x - paddle.x) <= paddle.width / 2 + ball.radius
    ) {
      ball.position.y = paddle.y + paddle.height / 2 + ball.radius;
      const impact = clamp((ball.position.x - paddle.x) / (paddle.width / 2), -1, 1);
      const speed = clamp(Math.hypot(ball.velocity.x, ball.velocity.y), 5.6, 8.6);
      const angle = impact * 1.05;
      ball.velocity.x = Math.sin(angle) * speed;
      ball.velocity.y = Math.max(2.2, Math.cos(angle) * speed);
      this.snapshot.combo = 0;
    }
  }

  private collideBlocks(ball: Ball) {
    for (const block of this.snapshot.blocks) {
      if (!block.active || !circleAabb(ball, block)) continue;
      const dx = ball.position.x - block.position.x;
      const dy = ball.position.y - block.position.y;
      const overlapX = block.size.x / 2 + ball.radius - Math.abs(dx);
      const overlapY = block.size.y / 2 + ball.radius - Math.abs(dy);
      if (!ball.effects.has('PIERCING')) {
        if (overlapX < overlapY) ball.velocity.x *= -1;
        else ball.velocity.y *= -1;
      }
      block.hitPoints -= ball.damage;
      this.snapshot.combo += 1;
      this.snapshot.score += 100 * Math.max(1, Math.floor(this.snapshot.combo / 5) + 1);
      this.events.push({
        tick: this.snapshot.tick,
        type: 'BLOCK_HIT',
        entityId: block.id,
        value: block.hitPoints,
      });
      if (block.hitPoints <= 0) {
        block.active = false;
        this.snapshot.score += 250;
        this.events.push({
          tick: this.snapshot.tick,
          type: 'BLOCK_DESTROYED',
          entityId: block.id,
        });
        if (block.bonus) {
          this.events.push({
            tick: this.snapshot.tick,
            type: 'BONUS_DROPPED',
            entityId: block.id,
          });
        }
      }
      break;
    }
  }

  private loseLife() {
    this.snapshot.lives -= 1;
    this.events.push({ tick: this.snapshot.tick, type: 'LIFE_LOST' });
    if (this.snapshot.lives <= 0) {
      this.snapshot.status = 'FAILED';
      this.events.push({ tick: this.snapshot.tick, type: 'GAME_OVER' });
      return;
    }
    this.snapshot.balls = [
      this.makeBall(this.snapshot.paddle.x, this.snapshot.paddle.y + 0.35, 0, 0),
    ];
    this.snapshot.status = 'READY';
  }

  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }
}

export const createDemoLevel = (): LevelDefinition => ({
  version: 1,
  name: 'Neon Awakening',
  type: 'NORMAL',
  world: 1,
  index: 1,
  theme: 'neon-grid',
  seed: 14_779,
  metadata: { tutorial: true },
  blocks: Array.from({ length: 40 }, (_, index) => {
    const row = Math.floor(index / 8);
    const column = index % 8;
    return {
      id: `block-${index + 1}`,
      kind: row === 0 ? 'TOUGH' : index % 11 === 0 ? 'EXPLOSIVE' : 'NORMAL',
      x: 0.08 + column * 0.12,
      y: 0.78 - row * 0.065,
      width: 0.102,
      height: 0.042,
      hitPoints: row === 0 ? 2 : 1,
      rotation: 0,
      bonus: index === 18 ? 'BALL_3' : index === 29 ? 'BALL_DOUBLE' : null,
      required: true,
    };
  }),
});
