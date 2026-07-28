'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PulseEngine, type EngineSnapshot } from '@pulse/game-engine';
import { levelDefinitionSchema, type LevelDefinition } from '@pulse/shared';
import { gameApi, type SessionStart } from '../lib/api';
import { loadSettings, resolveQuality, saveSettings, type GameSettings } from '../lib/settings';
import { GameRenderer } from './GameRenderer';

interface ViewState {
  score: number;
  lives: number;
  balls: number;
  combo: number;
  overcharge: number;
  blocksRemaining: number;
  status: EngineSnapshot['status'];
}

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
  lives: 5,
  balls: 1,
  combo: 0,
  overcharge: 1,
  blocksRemaining: 0,
  status: 'READY',
};

export function GameCanvas({
  session,
  onExit,
}: {
  session: SessionStart;
  onExit: (summary: CompletionSummary | null) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PulseEngine | null>(null);
  const submittedRef = useRef(false);
  const [view, setView] = useState(initialView);
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
      setSubmitError(error instanceof Error ? error.message : 'Sonuç gönderilemedi');
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
      setSubmitError('Bölüm verisi okunamadı.');
      return;
    }

    const engine = new PulseEngine(definition, {
      seed: session.seed,
      maxBalls: session.maxBalls,
      lives: session.lives,
      levelId: session.level.id,
      recordReplay: true,
    });
    engineRef.current = engine;

    const quality = resolveQuality(settings.quality);
    const renderer = new GameRenderer(mount, engine, {
      ...quality,
      trailLength: settings.showTrails ? quality.trailLength : 0,
      maxParticles: settings.reducedMotion ? Math.min(40, quality.maxParticles) : quality.maxParticles,
    });

    let frame = 0;
    let last = performance.now();
    let hudAccumulator = 0;
    let finished = false;

    const loop = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;
      engine.update(delta);
      renderer.emitEvents(engine.drainEvents());
      renderer.render(delta);

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
          status: snapshot.status,
        });
      }

      if (!finished && (engine.snapshot.status === 'COMPLETED' || engine.snapshot.status === 'FAILED')) {
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
      pointerActive = true;
      pointerOrigin = event.clientX;
      renderer.domElement.setPointerCapture(event.pointerId);
      engine.setPaddleTarget(renderer.pointerToBoardX(event.clientX));
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointerActive) return;
      engine.setPaddleTarget(renderer.pointerToBoardX(event.clientX));
      // Moving the paddle far enough before release fires the ball in that
      // direction: the launch angle comes from how the player swiped.
      if (engine.snapshot.status === 'READY' && Math.abs(event.clientX - pointerOrigin) > 16) {
        engine.launch();
        setHelpVisible(false);
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      if (engine.snapshot.status === 'READY') {
        engine.setPaddleTarget(renderer.pointerToBoardX(event.clientX));
        engine.launch();
        setHelpVisible(false);
      }
      pointerActive = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const paddle = engine.snapshot.paddle;
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        engine.setPaddleTarget(paddle.targetX - 0.7);
      } else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        engine.setPaddleTarget(paddle.targetX + 0.7);
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
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
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
          ← Çıkış
        </button>
        <div className="level-title">
          <span>
            DÜNYA {String(session.level.world).padStart(2, '0')} · {session.level.theme.toUpperCase()}
          </span>
          <strong>{session.level.name}</strong>
        </div>
        <div className="game-controls">
          <button type="button" onClick={() => setSettingsOpen((open) => !open)} aria-label="Ayarlar">
            ⚙
          </button>
          <button type="button" onClick={togglePause}>
            {view.status === 'PAUSED' ? 'DEVAM' : 'DURAKLAT'}
          </button>
        </div>
      </header>

      <div className="game-stage">
        <aside className="hud-panel">
          <span>SKOR</span>
          <strong>{view.score.toLocaleString('tr-TR')}</strong>
          <span>KOMBO</span>
          <strong className="accent">×{comboMultiplier}</strong>
          {view.overcharge > 1 && (
            <>
              <span>OVERCHARGE</span>
              <strong className="overcharge">×{view.overcharge.toFixed(2)}</strong>
            </>
          )}
        </aside>

        <div className="canvas-frame">
          <div ref={mountRef} className="game-canvas" />

          {helpVisible && view.status === 'READY' && (
            <div className="game-instruction">
              <span>↔</span>
              <strong>PLATFORMU HAREKET ETTİR</strong>
              <p>İlk hareketin topun çıkış açısını belirler.</p>
            </div>
          )}

          {settingsOpen && (
            <div className="settings-panel">
              <h2>Görüntü ayarları</h2>
              <label>
                Grafik kalitesi
                <select
                  value={settings.quality}
                  onChange={(event) =>
                    updateSettings({ quality: event.target.value as GameSettings['quality'] })
                  }
                >
                  <option value="AUTO">Otomatik</option>
                  <option value="LOW">Düşük</option>
                  <option value="MEDIUM">Orta</option>
                  <option value="HIGH">Yüksek</option>
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
                Azaltılmış hareket
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={settings.soundEnabled}
                  onChange={(event) => updateSettings({ soundEnabled: event.target.checked })}
                />
                Ses
              </label>
              <p className="settings-note">Kalite değişikliği sahneyi yeniden oluşturur.</p>
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
              <span>{view.status === 'COMPLETED' ? 'BÖLÜM TAMAMLANDI' : 'ENERJİ TÜKENDİ'}</span>
              <h1>{view.score.toLocaleString('tr-TR')} puan</h1>

              {submitting && <p>Sonuç doğrulanıyor…</p>}
              {submitError && <p className="error">{submitError}</p>}

              {summary && !summary.accepted && (
                <p className="error">
                  Sunucu bu sonucu doğrulayamadı ({summary.reasons.join(', ') || 'bilinmeyen sebep'}).
                  Skor kaydedilmedi.
                </p>
              )}

              {summary?.rewards && (
                <ul className="reward-list">
                  <li>+{summary.rewards.credits} kredi</li>
                  {summary.rewards.crystals > 0 && <li>+{summary.rewards.crystals} kristal</li>}
                  <li>+{summary.rewards.experience} XP</li>
                  {summary.rewards.personalBest && <li className="accent">Kişisel rekor!</li>}
                  {summary.rewards.achievementsUnlocked.map((key) => (
                    <li key={key} className="accent">
                      Başarım açıldı: {key}
                    </li>
                  ))}
                </ul>
              )}

              <button type="button" className="button button-primary" onClick={() => onExit(summary)}>
                Bölüm listesine dön
              </button>
            </div>
          )}
        </div>

        <aside className="hud-panel hud-panel-right">
          <span>CAN</span>
          <strong>{'♥'.repeat(Math.max(0, view.lives))}</strong>
          <span>AKTİF TOP</span>
          <strong className="accent">{view.balls}</strong>
          <span>KALAN BLOK</span>
          <strong>{view.blocksRemaining}</strong>
        </aside>
      </div>

      <footer className="game-footer">
        <span>SÜRÜKLE / FARE / ← →</span>
        <span>SABİT 120 HZ FİZİK</span>
        <span>MAKS {session.maxBalls} TOP</span>
      </footer>
    </section>
  );
}
