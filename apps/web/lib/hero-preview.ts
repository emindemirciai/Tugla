import type { CSSProperties } from 'react';

export interface HeroPreviewPoint {
  x: number;
  y: number;
}

export interface HeroPreviewBall {
  points: readonly [HeroPreviewPoint, HeroPreviewPoint, HeroPreviewPoint, HeroPreviewPoint];
  duration: number;
  delay: number;
  tone: 'peach' | 'aqua' | 'violet';
}

/**
 * Deterministic showcase trajectories for the landing-page playfield.
 *
 * They deliberately avoid a stationary centre point: the old preview lined up
 * several white dots through the middle and one read as a stray background orb.
 * Every point remains inside the padded playfield while crossing enough of the
 * board to resemble a real brick-breaker rally.
 */
export const HERO_PREVIEW_BALLS: readonly HeroPreviewBall[] = [
  {
    points: [
      { x: 12, y: 84 },
      { x: 28, y: 24 },
      { x: 67, y: 57 },
      { x: 88, y: 18 },
    ],
    duration: 4.1,
    delay: -1.2,
    tone: 'peach',
  },
  {
    points: [
      { x: 84, y: 78 },
      { x: 62, y: 17 },
      { x: 31, y: 62 },
      { x: 8, y: 28 },
    ],
    duration: 4.8,
    delay: -3.4,
    tone: 'aqua',
  },
  {
    points: [
      { x: 46, y: 88 },
      { x: 11, y: 42 },
      { x: 57, y: 14 },
      { x: 91, y: 55 },
    ],
    duration: 5.2,
    delay: -2.1,
    tone: 'violet',
  },
  {
    points: [
      { x: 72, y: 86 },
      { x: 90, y: 38 },
      { x: 54, y: 19 },
      { x: 19, y: 69 },
    ],
    duration: 4.5,
    delay: -0.7,
    tone: 'peach',
  },
  {
    points: [
      { x: 24, y: 74 },
      { x: 48, y: 16 },
      { x: 86, y: 64 },
      { x: 63, y: 88 },
    ],
    duration: 5.5,
    delay: -4.3,
    tone: 'aqua',
  },
  {
    points: [
      { x: 92, y: 82 },
      { x: 70, y: 31 },
      { x: 34, y: 13 },
      { x: 9, y: 58 },
    ],
    duration: 4.3,
    delay: -2.8,
    tone: 'violet',
  },
  {
    points: [
      { x: 38, y: 82 },
      { x: 13, y: 21 },
      { x: 78, y: 46 },
      { x: 55, y: 91 },
    ],
    duration: 5.1,
    delay: -1.8,
    tone: 'peach',
  },
  {
    points: [
      { x: 64, y: 77 },
      { x: 89, y: 22 },
      { x: 42, y: 38 },
      { x: 16, y: 89 },
    ],
    duration: 4.7,
    delay: -3.7,
    tone: 'aqua',
  },
] as const;

/** Maps a trajectory to variables consumed by the single CSS bounce animation. */
export function heroPreviewBallStyle(ball: HeroPreviewBall): CSSProperties {
  return {
    '--x-0': `${ball.points[0].x}%`,
    '--y-0': `${ball.points[0].y}%`,
    '--x-1': `${ball.points[1].x}%`,
    '--y-1': `${ball.points[1].y}%`,
    '--x-2': `${ball.points[2].x}%`,
    '--y-2': `${ball.points[2].y}%`,
    '--x-3': `${ball.points[3].x}%`,
    '--y-3': `${ball.points[3].y}%`,
    '--ball-duration': `${ball.duration}s`,
    '--ball-delay': `${ball.delay}s`,
  } as CSSProperties;
}
