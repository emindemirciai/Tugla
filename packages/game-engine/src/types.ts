import type { BlockKind, BonusKind, LevelDefinition } from '@tugla/shared';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Ball {
  id: number;
  position: Vec2;
  previous: Vec2;
  velocity: Vec2;
  radius: number;
  damage: number;
  active: boolean;
  /** Bonus effects with their remaining duration in ticks (0 = permanent). */
  effects: Map<BonusKind, number>;
  /** Ticks the ball is stuck to the paddle (STICKY bonus). */
  stuckOffset: number | null;
}

export interface RuntimeBlock {
  id: string;
  kind: BlockKind;
  position: Vec2;
  origin: Vec2;
  size: Vec2;
  hitPoints: number;
  maxHitPoints: number;
  required: boolean;
  bonus?: BonusKind | null;
  active: boolean;
  /** Remaining ticks of damage immunity (SHIELDED). */
  shieldTicks: number;
  /** Ticks until a destroyed REGENERATING block returns. */
  regenTicks: number;
  motionRange: number;
  motionSpeed: number;
  motionPhase: number;
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  baseWidth: number;
  height: number;
  targetX: number;
  shield: number;
  /** Remaining ticks of PADDLE_GROW / MAGNET / STICKY effects. */
  growTicks: number;
  magnetTicks: number;
  stickyTicks: number;
  laserTicks: number;
}

export interface FallingBonus {
  id: number;
  kind: BonusKind;
  position: Vec2;
  velocityY: number;
  active: boolean;
}

export type GameEventType =
  | 'BALL_LOST'
  | 'BALL_SPAWNED'
  | 'BLOCK_HIT'
  | 'BLOCK_DESTROYED'
  | 'BLOCK_EXPLODED'
  | 'BLOCK_REGENERATED'
  | 'BONUS_DROPPED'
  | 'BONUS_COLLECTED'
  | 'PADDLE_HIT'
  | 'OVERCHARGE'
  | 'LIFE_LOST'
  | 'SHIELD_ABSORBED'
  | 'BOSS_DAMAGED'
  | 'BOSS_DEFEATED'
  | 'LEVEL_COMPLETED'
  | 'GAME_OVER';

export interface GameEvent {
  tick: number;
  type: GameEventType;
  entityId?: string | number;
  value?: number;
  x?: number;
  y?: number;
}

export type EngineStatus = 'READY' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';

export interface EngineSnapshot {
  tick: number;
  score: number;
  combo: number;
  bestCombo: number;
  lives: number;
  balls: Ball[];
  blocks: RuntimeBlock[];
  bonuses: FallingBonus[];
  paddle: Paddle;
  status: EngineStatus;
  /** Damage multiplier granted by Overcharge once the ball cap is reached. */
  overcharge: number;
  blocksDestroyed: number;
  maxBallsReached: number;
  bossDefeated: boolean;
}

export interface EngineOptions {
  width?: number;
  height?: number;
  lives?: number;
  maxBalls?: number;
  fixedStep?: number;
  seed?: number;
  levelId?: string;
  /** Disables replay recording (used when replaying an existing document). */
  recordReplay?: boolean;
}

export type EngineLevel = LevelDefinition;
