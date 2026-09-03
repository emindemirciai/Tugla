'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TuğlaEngine, type EngineSnapshot } from '@tugla/game-engine';
import { levelDefinitionSchema, type LevelDefinition } from '@tugla/shared';
import { gameApi, type SessionStart } from '../lib/api';
import { GameAudio } from '../lib/audio';
import { loadSettings, resolveQuality, saveSettings, type GameSettings } from '../lib/settings';
import { GameRenderer } from './GameRenderer';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { ThemeSwitcher } from './ThemeSwitcher';

/**
 * One running bonus, as the HUD needs it.
 *
 * The effects were invisible: MAGNET and LASER did nothing at all until this
 * pass fixed them, and even the ones that always worked (sticky, slow time, the
 * safety net) gave no indication they were on or how long was left. A player
 * could not tell a bonus had been collected, which is most of why every pickup
 * felt like the same thing.
 */
interface ActiveEffect {
  id: string;
  label: TranslationKey;
  /** Ticks left, at the fixed 120 Hz simulation rate. */
  ticks: number;
  /** Drives the drain bar; null for effects with no fixed duration. */
  fraction: number | null;
  tone: 'paddle' | 'ball' | 'floor';
}

/**
 * Reads every running effect out of a snapshot.
 *
 * Pure and exported so the HUD's contents can be tested without a canvas, a
 * WebGL context or a running rally.
 */
export const readActiveEffects = (snapshot: EngineSnapshot): ActiveEffect[] => {
  const paddle = snapshot.paddle;
  const effects: ActiveEffect[] = [];

  // Paddle-side effects, with the duration the engine grants each one
  // (EFFECT_TICKS in engine.ts, at the fixed 120 Hz rate).
  const paddleTimers: [string, TranslationKey, number, number][] = [
    ['grow', 'game.effect.paddleGrow', paddle.growTicks, 1800],
    ['magnet', 'game.effect.magnet', paddle.magnetTicks, 1440],
    ['sticky', 'game.effect.sticky', paddle.stickyTicks, 1440],
    ['laser', 'game.effect.laser', paddle.laserTicks, 960],
  ];
  for (const [id, label, ticks, full] of paddleTimers) {
    if (ticks > 0) {
      effects.push({ id, label, ticks, fraction: Math.min(1, ticks / full), tone: 'paddle' });
    }
  }

  if (snapshot.safetyNetTicks > 0) {
    effects.push({
      id: 'net',
      label: 'game.effect.safetyNet',
      ticks: snapshot.safetyNetTicks,
      fraction: Math.min(1, snapshot.safetyNetTicks / 600),
      tone: 'floor',
    });
  }
  // The shield is a charge, not a timer: it survives exactly one miss.
  if (paddle.shield > 0) {
    effects.push({
      id: 'shield',
      label: 'game.effect.shield',
      ticks: 0,
      fraction: null,
      tone: 'floor',
    });
  }

  // Ball effects live per ball. Shown once, with the longest remaining life, so
  // a five-ball board does not stack five identical chips.
  const ballEffects: [string, TranslationKey, number][] = [
    ['SLOW_TIME', 'game.effect.slowTime', 720],
    ['FIREBALL', 'game.effect.fireball', 1440],
    ['PIERCING', 'game.effect.piercing', 1200],
    ['EXPLOSIVE', 'game.effect.explosive', 1200],
    ['CHAIN_LIGHTNING', 'game.effect.chainLightning', 1200],
    ['GIANT_BALL', 'game.effect.giantBall', 1080],
  ];
  for (const [key, label, full] of ballEffects) {
    let longest = 0;
    for (const ball of snapshot.balls) {
      if (!ball.active) continue;
      longest = Math.max(longest, ball.effects.get(key as never) ?? 0);
    }
    if (longest > 0) {
      effects.push({
        id: key,
        label,
        ticks: longest,
        fraction: Math.min(1, longest / full),
        tone: 'ball',
      });
    }
  }

  // Soonest to expire first: the one the player has to act on is at the top.
  return effects.sort((a, b) => a.ticks - b.ticks);
};

interface ViewState {
  score: number;
  lives: number;
  balls: number;
  combo: number;
  overcharge: number;
  blocksRemaining: number;
  tick: number;
  status: EngineSnapshot['status'];
  effects: ActiveEffect[];
}

/** Ticks run at a fixed 120 Hz, so elapsed time is exact, not wall-clock. */
/**
 * Stopwatch readout: hours:minutes:seconds, driven by the fixed 120 Hz
 * tick rather than the wall clock, so it pauses with the game and matches the
 * duration the server verifies.
 */
export const formatElapsed = (tick: number) => {
  const totalSeconds = Math.floor(tick / 120);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
};

export interface CompletionSummary {
  accepted: boolean;
  status: string;
  reasons: string[];
  rewards: {
    credits: number;
    crystals: number;
    experience: number;
    playerLevel: number;
    tasksCompleted: string[];
    achievementsUnlocked: string[];
    personalBest: boolean;
  } | null;
}

const initialView: ViewState = {
  score: 0,
  lives: 3,
  balls: 1,
  combo: 0,
  overcharge: 1,
  blocksRemaining: 0,
  tick: 0,
  status: 'READY',
  effects: [],
};

export function GameCanvas({
  session,
  onExit,
  onNextLevel,
}: {
  session: SessionStart;
  onExit: (summary: CompletionSummary | null) => void;
  /**
   * Start the next level directly. Absent when there is no next level to go to
   * — the last level of the campaign, or a daily run, where the button would
   * promise something the hub cannot deliver.
   */
  onNextLevel?: (summary: CompletionSummary | null) => void;
}) {
  const { t, locale } = useI18n();
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<TuğlaEngine | null>(null);
  const submittedRef = useRef(false);
  const [view, setView] = useState(initialView);
  const clockRef = useRef<HTMLElement>(null);
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpVisible, setHelpVisible] = useState(true);
  const [summary, setSummary] = useState<CompletionSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const togglePause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.pause(engine.snapshot.status !== 'PAUSED');
    setView((current) => ({ ...current, status: engine.snapshot.status }));
  }, []);

  /** Submits the signed result; the server re-simulates it before accepting. */
  const submit = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = engine.buildResult({
        sessionId: session.sessionId,
        nonce: session.nonce,
      });
      const response = await gameApi.completeSession(result as unknown as Record<string, unknown>);
      setSummary({
        accepted: response.accepted,
        status: response.status,
        reasons: response.reasons,
        rewards: response.rewards,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t('game.over.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  }, [session.nonce, session.sessionId]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let definition: LevelDefinition;
    try {
      definition = levelDefinitionSchema.parse(session.level.definition);
    } catch {
      setSubmitError(t('game.error.levelData'));
      return;
    }

    const engine = new TuğlaEngine(definition, {
      seed: session.seed,
      maxBalls: session.maxBalls,
      lives: session.lives,
      levelId: session.level.id,
      recordReplay: true,
    });
    engineRef.current = engine;

    const audio = new GameAudio();
    audio.enabled = settings.soundEnabled;
    // Entering a level is itself a click, and activation is sticky for the
    // document, so the device can usually be opened right away.
    if (settings.soundEnabled) audio.unlock();
    const quality = resolveQuality(settings.quality);
    const renderer = new GameRenderer(
      mount,
      engine,
      {
        ...quality,
        trailLength: settings.showTrails ? quality.trailLength : 0,
        maxParticles: settings.reducedMotion
          ? Math.min(40, quality.maxParticles)
          : quality.maxParticles,
      },
      { theme: session.level.theme, index: session.level.index },
      // What the player equipped in the shop, delivered with the session so the
      // level start stays a single round trip.
      session.cosmetics ?? [],
    );

    let frame = 0;
    let last = performance.now();
    let hudAccumulator = 0;
    let finished = false;

    const loop = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;
      engine.update(delta);
      const events = engine.drainEvents();
      renderer.emitEvents(events);
      audio.handle(events);
      renderer.render(delta);

      // Written every frame: re-rendering the whole HUD at this rate would be
      // wasteful, and a stopwatch that only moves ten times a second stutters.
      if (clockRef.current) clockRef.current.textContent = formatElapsed(engine.snapshot.tick);

      hudAccumulator += delta;
      if (hudAccumulator > 0.1) {
        hudAccumulator = 0;
        const snapshot = engine.snapshot;
        setView({
          score: snapshot.score,
          lives: snapshot.lives,
          balls: snapshot.balls.length,
          combo: snapshot.combo,
          overcharge: snapshot.overcharge,
          blocksRemaining: snapshot.blocks.filter((block) => block.active && block.required).length,
          tick: snapshot.tick,
          status: snapshot.status,
          effects: readActiveEffects(snapshot),
        });
      }

      if (
        !finished &&
        (engine.snapshot.status === 'COMPLETED' || engine.snapshot.status === 'FAILED')
      ) {
        finished = true;
        void submit();
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    const onResize = () => renderer.resize();
    let pointerActive = false;
    let pointerOrigin = 0;

    const onPointerDown = (event: PointerEvent) => {
      // Without this the browser treats a drag as a scroll gesture, cancels the
      // pointer stream and the paddle freezes — which is exactly how the game
      // behaved on phones. The canvas also sets touch-action: none.
      event.preventDefault();
      // Opening the audio device needs a real gesture; this is the earliest one
      // in a level, so the very first paddle hit already has sound.
      audio.unlock();
      pointerActive = true;
      pointerOrigin = event.clientX;
      renderer.domElement.setPointerCapture(event.pointerId);
      engine.setPaddleTarget(renderer.pointerToBoardX(event.clientX, event.clientY));
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointerActive) return;
      event.preventDefault();
      engine.setPaddleTarget(renderer.pointerToBoardX(event.clientX, event.clientY));
      // Moving the paddle far enough before release fires the ball in that
      // direction: the launch angle comes from how the player swiped.
      if (engine.snapshot.status === 'READY' && Math.abs(event.clientX - pointerOrigin) > 16) {
        engine.launch();
        setHelpVisible(false);
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      if (engine.snapshot.status === 'READY') {
        engine.setPaddleTarget(renderer.pointerToBoardX(event.clientX, event.clientY));
        engine.launch();
        setHelpVisible(false);
      }
      pointerActive = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      audio.unlock();
      const paddle = engine.snapshot.paddle;
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        engine.setPaddleTarget(paddle.targetX - 1.1);
      } else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        engine.setPaddleTarget(paddle.targetX + 1.1);
      } else if (event.key === ' ') {
        event.preventDefault();
        engine.launch();
        setHelpVisible(false);
      } else if (event.key === 'Escape') {
        togglePause();
      }
    };
    const onVisibility = () => {
      if (document.hidden) engine.pause(true);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibility);
    // passive: false, otherwise preventDefault is ignored on touch devices.
    renderer.domElement.addEventListener('pointerdown', onPointerDown, { passive: false });
    renderer.domElement.addEventListener('pointermove', onPointerMove, { passive: false });
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.dispose();
      audio.dispose();
      engineRef.current = null;
    };
  }, [session, settings, submit, togglePause]);

  const updateSettings = (patch: Partial<GameSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  const comboMultiplier = Math.min(8, Math.max(1, Math.floor(view.combo / 5) + 1));

  return (
    <section className="game-shell">
      <header className="game-topbar">
        <button type="button" className="icon-button" onClick={() => onExit(summary)}>
          {t('game.exit')}
        </button>
        <div className="level-title">
          <span>
            {t('game.world')} {String(session.level.world).padStart(2, '0')} ·{' '}
            {session.level.theme.replace(/-/g, ' ').toUpperCase()}
          </span>
          <strong className="game-level-name">{session.level.name}</strong>
        </div>
        <div className="game-controls">
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-label={t('game.settingsAria')}
          >
            ⚙
          </button>
          <button type="button" onClick={togglePause}>
            {view.status === 'PAUSED' ? t('game.resume') : t('game.pause')}
          </button>
        </div>
      </header>

      <div className="game-stage">
        <aside className="hud-panel">
          <div className="hud-stat">
            <span>{t('game.hud.score')}</span>
            <strong>{view.score.toLocaleString(locale)}</strong>
          </div>
          <div className="hud-stat">
            <span>{t('game.hud.combo')}</span>
            <strong className="accent">×{comboMultiplier}</strong>
          </div>
          {view.overcharge > 1 && (
            <div className="hud-stat">
              <span>{t('game.hud.overcharge')}</span>
              <strong className="overcharge">×{view.overcharge.toFixed(2)}</strong>
            </div>
          )}
          <div className="hud-stat">
            <span>{t('game.hud.lives')}</span>
            <strong className="hud-lives">{'♥'.repeat(Math.max(0, view.lives))}</strong>
          </div>
          <div className="hud-stat">
            <span>{t('game.hud.balls')}</span>
            <strong className="accent">{view.balls}</strong>
          </div>
          <div className="hud-stat">
            <span>{t('game.hud.blocks')}</span>
            <strong>{view.blocksRemaining}</strong>
          </div>
          <div className="hud-stat hud-time">
            <span>{t('game.hud.time')}</span>
            <strong ref={clockRef}>{formatElapsed(view.tick)}</strong>
          </div>

          {view.effects.length > 0 && (
            <div className="hud-effects">
              <span className="hud-effects-label">{t('game.hud.effects')}</span>
              {view.effects.map((effect) => (
                <div key={effect.id} className={`hud-effect hud-effect-${effect.tone}`}>
                  <span className="hud-effect-name">{t(effect.label)}</span>
                  {effect.ticks > 0 && (
                    <span className="hud-effect-time">
                      {t('game.effect.seconds', { count: Math.ceil(effect.ticks / 120) })}
                    </span>
                  )}
                  {effect.fraction !== null && (
                    <span className="hud-effect-bar">
                      {/* Inline width: it changes ten times a second, which is
                          a value, not a style choice. */}
                      <i style={{ width: `${Math.round(effect.fraction * 100)}%` }} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>

        <div className="canvas-frame">
          <div ref={mountRef} className="game-canvas" />

          {helpVisible && view.status === 'READY' && (
            <div className="game-instruction">
              <span>↔</span>
              <strong>{t('game.instruction.title')}</strong>
              <p>{t('game.instruction.body')}</p>
            </div>
          )}

          {settingsOpen && (
            <div className="settings-panel">
              <h2>{t('game.settings.title')}</h2>
              <label>
                Grafik kalitesi
                <select
                  value={settings.quality}
                  onChange={(event) =>
                    updateSettings({ quality: event.target.value as GameSettings['quality'] })
                  }
                >
                  <option value="AUTO">Otomatik</option>
                  <option value="LOW">{t('game.settings.low')}</option>
                  <option value="MEDIUM">Orta</option>
                  <option value="HIGH">{t('game.settings.high')}</option>
                </select>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={settings.showTrails}
                  onChange={(event) => updateSettings({ showTrails: event.target.checked })}
                />
                Top izi
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={settings.reducedMotion}
                  onChange={(event) => updateSettings({ reducedMotion: event.target.checked })}
                />
                {t('game.settings.reducedMotion')}
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={settings.soundEnabled}
                  onChange={(event) => updateSettings({ soundEnabled: event.target.checked })}
                />
                Ses
              </label>
              <label>
                {t('theme.label')}
                <ThemeSwitcher />
              </label>
              <p className="settings-note">{t('game.settings.note')}</p>
              <button type="button" className="button" onClick={() => setSettingsOpen(false)}>
                Kapat
              </button>
            </div>
          )}

          {view.status === 'PAUSED' && (
            <div className="game-overlay">
              <span>DURAKLATILDI</span>
              <h1>Ritmi dondurdun.</h1>
              <button type="button" className="button button-primary" onClick={togglePause}>
                Devam et
              </button>
            </div>
          )}

          {(view.status === 'COMPLETED' || view.status === 'FAILED') && (
            <div className="game-overlay">
              <span>
                {view.status === 'COMPLETED' ? t('game.over.completed') : t('game.over.failed')}
              </span>
              <h1>{t('game.over.points', { score: view.score.toLocaleString(locale) })}</h1>

              {submitting && <p>{t('game.over.verifying')}</p>}
              {submitError && <p className="error">{submitError}</p>}

              {summary && !summary.accepted && (
                <p className="error">
                  {t('game.over.rejected', {
                    reasons: summary.reasons.join(', ') || t('game.over.rejectedUnknown'),
                  })}
                </p>
              )}

              {summary?.rewards && (
                <ul className="reward-list">
                  <li>{t('game.over.credits', { count: summary.rewards.credits })}</li>
                  {summary.rewards.crystals > 0 && (
                    <li>{t('game.over.crystals', { count: summary.rewards.crystals })}</li>
                  )}
                  <li>{t('game.over.xp', { count: summary.rewards.experience })}</li>
                  {summary.rewards.personalBest && (
                    <li className="accent">{t('game.over.personalBest')}</li>
                  )}
                  {summary.rewards.achievementsUnlocked.map((key) => (
                    <li key={key} className="accent">
                      {t('game.over.achievement', { name: key })}
                    </li>
                  ))}
                </ul>
              )}

              {/*
                Two ways out, and the one people want most is offered first.
                Clearing a level and then having to find it again in a grid of
                five hundred is the kind of friction that ends a session; the
                next level is one tap away when it exists and is unlocked.
              */}
              <div className="overlay-actions">
                {view.status === 'COMPLETED' && summary?.accepted && onNextLevel && (
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => onNextLevel(summary)}
                  >
                    {t('game.over.nextLevel')}
                  </button>
                )}
                <button
                  type="button"
                  className={
                    view.status === 'COMPLETED' && summary?.accepted && onNextLevel
                      ? 'button'
                      : 'button button-primary'
                  }
                  onClick={() => onExit(summary)}
                >
                  {t('game.over.backToLevels')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
