import { decodeReplay } from '@tugla/shared';
import { describe, expect, it } from 'vitest';
import { TuğlaEngine } from './engine';
import { generateCampaignLevel } from './levels';
import { runReplay } from './replay-runner';

/**
 * Plays a level the way the browser does — irregular frame times, the paddle
 * chasing the ball — and returns both the live outcome and the verification
 * outcome the API would compute.
 *
 * This is the regression guard for the bug that rejected honest players with
 * `replay-score-mismatch`: the live run steered with full double precision
 * while the replay only had four decimals, and the two simulations drifted
 * apart.
 */
const playAndVerify = (levelIndex: number, seed: number) => {
  const level = generateCampaignLevel(levelIndex);
  const engine = new TuğlaEngine(level, {
    seed,
    levelId: `test-${levelIndex}`,
    recordReplay: true,
  });

  engine.setPaddleTarget(4.5);
  engine.launch();
  for (let frame = 0; frame < 20_000; frame += 1) {
    const ball = engine.snapshot.balls[0];
    // Deliberately un-rounded input, exactly like a pointer would produce.
    if (ball) engine.setPaddleTarget(ball.position.x + Math.sin(frame / 40) * 0.35);
    engine.update(0.016 + (frame % 5) * 0.0013);
    if (engine.snapshot.status === 'COMPLETED' || engine.snapshot.status === 'FAILED') break;
  }

  const replayed = runReplay(level, decodeReplay(engine.encodeReplay()), { maxTicks: 600_000 });
  return {
    live: {
      score: engine.snapshot.score,
      completed: engine.snapshot.status === 'COMPLETED',
      blocksDestroyed: engine.snapshot.blocksDestroyed,
    },
    replayed,
  };
};

describe('replay verification reproduces honest play', () => {
  for (const levelIndex of [1, 3, 8, 21, 55]) {
    it(`matches score and outcome for level ${levelIndex}`, () => {
      const { live, replayed } = playAndVerify(levelIndex, 1000 + levelIndex);
      expect(replayed.score).toBe(live.score);
      expect(replayed.completed).toBe(live.completed);
      expect(replayed.blocksDestroyed).toBe(live.blocksDestroyed);
    });
  }

  it('quantises the paddle target so live play and replay share one number', () => {
    const engine = new TuğlaEngine(generateCampaignLevel(1), { seed: 7, recordReplay: true });
    engine.setPaddleTarget(4.123456789);
    expect(engine.snapshot.paddle.targetX).toBe(4.1235);
  });

  it('never simulates past the tick the client reported', () => {
    const level = generateCampaignLevel(2);
    const engine = new TuğlaEngine(level, { seed: 9, recordReplay: true });
    engine.launch();
    for (let frame = 0; frame < 200; frame += 1) engine.update(0.016);
    const document = decodeReplay(engine.encodeReplay());
    const replayed = runReplay(level, document, { maxTicks: 600_000 });
    expect(replayed.finalTick).toBeLessThanOrEqual(document.finalTick + 1);
  });
});
