import { decodeReplay, type LevelDefinition, type ReplayDocument } from '@pulse/shared';
import { PulseEngine } from './engine';
import type { EngineSnapshot } from './types';

export interface ReplayResult {
  snapshot: EngineSnapshot;
  score: number;
  finalTick: number;
  completed: boolean;
  blocksDestroyed: number;
  maxBalls: number;
  livesRemaining: number;
}

/**
 * Re-simulates a replay document against its level.
 *
 * The API uses this to independently reproduce a submitted score: if the
 * replay does not reproduce the reported score, the submission is rejected
 * regardless of what the client claimed.
 */
export const runReplay = (
  level: LevelDefinition,
  document: ReplayDocument,
  options: { maxTicks?: number } = {},
): ReplayResult => {
  const engine = new PulseEngine(level, {
    width: document.width,
    height: document.height,
    fixedStep: document.fixedStep,
    maxBalls: document.maxBalls,
    lives: document.lives,
    seed: document.seed,
    levelId: document.levelId,
    recordReplay: false,
  });

  const maxTicks = Math.min(options.maxTicks ?? 600_000, Math.max(document.finalTick, 1) + 2);
  const byTick = new Map<number, typeof document.inputs>();
  for (const input of document.inputs) {
    const bucket = byTick.get(input.t);
    if (bucket) bucket.push(input);
    else byTick.set(input.t, [input]);
  }

  for (let tick = 0; tick <= maxTicks; tick += 1) {
    const inputs = byTick.get(tick);
    if (inputs) {
      for (const input of inputs) {
        if (input.k === 'm') engine.setPaddleTarget(input.v, { record: false });
        else if (input.k === 'l') engine.launch({ record: false });
      }
    }
    if (engine.snapshot.status === 'COMPLETED' || engine.snapshot.status === 'FAILED') break;
    engine.step();
  }

  return {
    snapshot: engine.snapshot,
    score: engine.snapshot.score,
    finalTick: engine.snapshot.tick,
    completed: engine.snapshot.status === 'COMPLETED',
    blocksDestroyed: engine.snapshot.blocksDestroyed,
    maxBalls: engine.snapshot.maxBallsReached,
    livesRemaining: Math.max(0, engine.snapshot.lives),
  };
};

export const runEncodedReplay = (
  level: LevelDefinition,
  raw: string,
  options?: { maxTicks?: number },
) => runReplay(level, decodeReplay(raw), options);
