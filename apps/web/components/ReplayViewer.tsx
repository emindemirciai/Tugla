'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareReplayPlayback } from '@tugla/game-engine';
import { decodeReplay, type LevelDefinition } from '@tugla/shared';
import { GameRenderer } from './GameRenderer';
import { useI18n } from '../lib/i18n';
import { loadSettings, resolveQuality } from '../lib/settings';

/**
 * Replay viewer.
 *
 * The recording is a list of paddle movements, not a video: the engine replays
 * them against the same level with the same seed, so what you watch is the run
 * itself rather than a picture of it. That is also why the score shown here can
 * be trusted — it is recomputed, not read from a field.
 */
export function ReplayViewer({
  level,
  encoded,
  expectedScore,
}: {
  level: LevelDefinition;
  encoded: unknown;
  expectedScore: number;
}) {
  const { t, locale } = useI18n();
  const mount = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'playing' | 'finished' | 'error'>('loading');
  const [score, setScore] = useState(0);
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    const container = mount.current;
    if (!container) return;

    let renderer: GameRenderer | null = null;
    let frame = 0;
    let cancelled = false;

    try {
      const document_ = decodeReplay(
        typeof encoded === 'string' ? encoded : JSON.stringify(encoded),
      );
      const playback = prepareReplayPlayback(level, document_);
      renderer = new GameRenderer(
        container,
        playback.engine,
        resolveQuality(loadSettings().quality),
        level,
      );
      setStatus('playing');

      let carry = 0;
      let previous = performance.now();

      const loop = (now: number) => {
        if (cancelled) return;
        const delta = Math.min(0.25, (now - previous) / 1000);
        previous = now;

        // Fixed-step catch-up, exactly as the game runs: the number of ticks
        // follows elapsed time, so playback speed is honest on any refresh rate.
        carry += delta * speedRef.current;
        let running = true;
        while (carry >= playback.fixedStep && running) {
          carry -= playback.fixedStep;
          running = playback.advance();
        }

        renderer?.render(delta);
        setScore(playback.engine.snapshot.score);

        if (!running) {
          setStatus('finished');
          return;
        }
        frame = requestAnimationFrame(loop);
      };

      frame = requestAnimationFrame(loop);
    } catch {
      setStatus('error');
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      renderer?.dispose();
    };
  }, [level, encoded]);

  return (
    <div className="replay-viewer">
      <div className="canvas-frame replay-stage" ref={mount} />

      <div className="replay-controls">
        <span className="hud-stat">
          <span>{t('replays.liveScore')}</span>
          <strong>{score.toLocaleString(locale)}</strong>
        </span>
        <span className="hud-stat">
          <span>{t('replays.recordedScore')}</span>
          <strong>{expectedScore.toLocaleString(locale)}</strong>
        </span>

        <div className="segmented">
          {[0.5, 1, 2, 4].map((option) => (
            <button
              key={option}
              type="button"
              className={speed === option ? 'active' : ''}
              onClick={() => setSpeed(option)}
            >
              {option}×
            </button>
          ))}
        </div>
      </div>

      {status === 'error' && <p className="form-error">{t('replays.playbackFailed')}</p>}
      {status === 'finished' && <p className="muted">{t('replays.playbackFinished')}</p>}
    </div>
  );
}
