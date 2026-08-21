import { describe, expect, it } from 'vitest';
import { decodeReplay } from '@tugla/shared';
import { TuğlaEngine } from './engine';
import { generateCampaignLevel } from './levels';
import { prepareReplayPlayback, runReplay } from './replay-runner';

/**
 * Watching a replay must show the same run the server verified. If stepping
 * frame by frame produced a different outcome from the verification pass, the
 * player would be watching a fiction — so the two are pinned to each other.
 */
const record = () => {
  const level = generateCampaignLevel(3);
  const engine = new TuğlaEngine(level, { seed: 7, levelId: 'replay-test', recordReplay: true });
  engine.launch();
  for (let frame = 0; frame < 4000; frame += 1) {
    const ball = engine.snapshot.balls.find((candidate) => candidate.active);
    if (ball) engine.setPaddleTarget(ball.position.x);
    engine.update(1 / 120);
    if (engine.snapshot.status !== 'RUNNING') break;
  }
  return { level, document: decodeReplay(engine.encodeReplay()) };
};

describe('replay playback', () => {
  it('reaches the same score as verification', () => {
    const { level, document } = record();
    const verified = runReplay(level, document);

    const playback = prepareReplayPlayback(level, document);
    while (playback.advance()) {
      // Stepped exactly as a screen would step it.
    }

    expect(playback.engine.snapshot.score).toBe(verified.score);
    expect(playback.engine.snapshot.tick).toBe(verified.finalTick);
  });

  it('stops on its own instead of running forever', () => {
    const { level, document } = record();
    const playback = prepareReplayPlayback(level, document);

    let steps = 0;
    while (playback.advance()) steps += 1;

    expect(steps).toBeLessThanOrEqual(document.finalTick + 1);
    expect(playback.advance()).toBe(false);
  });

  it('starts from the recorded seed, not a fresh one', () => {
    const { level, document } = record();
    const first = prepareReplayPlayback(level, document);
    const second = prepareReplayPlayback(level, document);

    for (let step = 0; step < 200; step += 1) {
      first.advance();
      second.advance();
    }

    expect(first.engine.snapshot.score).toBe(second.engine.snapshot.score);
    expect(first.engine.snapshot.balls[0]?.position.x).toBe(
      second.engine.snapshot.balls[0]?.position.x,
    );
  });
});
