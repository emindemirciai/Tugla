import { decodeReplay, type LevelDefinition, type ReplayDocument } from '@tugla/shared';
import { TuğlaEngine } from './engine';
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
  const engine = new TuğlaEngine(level, {
    width: document.width,
    height: document.height,
    fixedStep: document.fixedStep,
    maxBalls: document.maxBalls,
    lives: document.lives,
    seed: document.seed,
    levelId: document.levelId,
    recordReplay: false,
  });

  // Stop exactly where the client stopped: two spare ticks were enough to
  // destroy one more block and report a different outcome for runs that ended
  // without a win or a loss.
  const maxTicks = Math.min(options.maxTicks ?? 600_000, Math.max(document.finalTick, 1));
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

/**
 * Prepares a replay for watching rather than verifying.
 *
 * Verification runs the whole recording as fast as the CPU allows and reports
 * the outcome. Watching needs the opposite: an engine that can be advanced one
 * tick at a time, in step with a screen refresh, with the recorded inputs
 * applied at exactly the ticks they were made. The stepping is the caller's —
 * this returns the engine and the function that feeds it.
 */
export const prepareReplayPlayback = (level: LevelDefinition, document: ReplayDocument) => {
  const engine = new TuğlaEngine(level, {
    width: document.width,
    height: document.height,
    fixedStep: document.fixedStep,
    maxBalls: document.maxBalls,
    lives: document.lives,
    seed: document.seed,
    levelId: document.levelId,
    recordReplay: false,
  });

  const byTick = new Map<number, ReplayDocument['inputs']>();
  for (const input of document.inputs) {
    const bucket = byTick.get(input.t);
    if (bucket) bucket.push(input);
    else byTick.set(input.t, [input]);
  }

  /** Advances one tick, applying whatever was recorded for it. Returns false at the end. */
  const advance = () => {
    if (engine.snapshot.tick > document.finalTick) return false;
    if (engine.snapshot.status === 'COMPLETED' || engine.snapshot.status === 'FAILED') return false;

    for (const input of byTick.get(engine.snapshot.tick) ?? []) {
      if (input.k === 'm') engine.setPaddleTarget(input.v, { record: false });
      else if (input.k === 'l') engine.launch({ record: false });
    }
    engine.step();
    return true;
  };

  return { engine, advance, finalTick: document.finalTick, fixedStep: document.fixedStep };
};

export const runEncodedReplay = (
  level: LevelDefinition,
  raw: string,
  options?: { maxTicks?: number },
) => runReplay(level, decodeReplay(raw), options);
