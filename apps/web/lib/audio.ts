'use client';

import type { GameEvent } from '@tugla/game-engine';

/**
 * Tiny WebAudio synthesiser for gameplay feedback.
 *
 * Sounds are generated procedurally (oscillator + gain envelope) so the game
 * ships zero audio assets, works offline, and stays a few hundred bytes. The
 * context is created lazily on first use because browsers require a user
 * gesture before audio may start.
 */
/**
 * Per-sound rate limit: at most one of each kind every 30ms, so a 500-ball
 * cascade cannot stack 500 oscillators. Pure and time-injected so it can be
 * tested without a browser.
 */
export const SOUND_INTERVAL_MS = 30;

export const shouldPlay = (last: Map<string, number>, key: string, nowMs: number) => {
  const previous = last.get(key);
  if (previous !== undefined && nowMs - previous < SOUND_INTERVAL_MS) return false;
  last.set(key, nowMs);
  return true;
};

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastPlay = new Map<string, number>();
  enabled = true;

  /**
   * Opens the audio device on a user gesture.
   *
   * A freshly created AudioContext starts suspended, and `resume()` is
   * asynchronous — so the first sounds of a level were scheduled against a
   * clock that had not started yet and were lost. Call this from a real
   * interaction (pointer down, key press) and the device is already running by
   * the time the ball touches anything.
   */
  unlock() {
    const context = this.ensureContext();
    if (context && context.state !== 'running') void context.resume();
  }

  private ensureContext() {
    if (typeof window === 'undefined') return null;
    if (!this.context) {
      const Ctor =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }

  /** Rate-limited beep so 500 simultaneous hits do not stack 500 oscillators. */
  private tone(
    key: string,
    frequency: number,
    duration: number,
    type: OscillatorType = 'sine',
    slide = 0,
  ) {
    if (!this.enabled) return;
    const context = this.ensureContext();
    if (!context || !this.master) return;

    // Rate limiting runs on the wall clock, not the audio clock. A suspended
    // context keeps currentTime at 0, so every sound compared 0 against 0 and
    // the guard silently swallowed all of them — which is exactly what "no
    // sound at the start of a level" looked like.
    if (!shouldPlay(this.lastPlay, key, performance.now())) return;

    const now = context.currentTime;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slide !== 0)
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(40, frequency + slide),
        now + duration,
      );
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  handle(events: GameEvent[]) {
    for (const event of events) {
      switch (event.type) {
        case 'BALL_SPAWNED':
          this.tone('launch', 320, 0.1, 'triangle', 240);
          break;
        case 'PADDLE_HIT':
          this.tone('paddle', 220, 0.06, 'sine', 60);
          break;
        case 'BLOCK_HIT':
          // A block that survived the hit: duller, lower, clearly not a break.
          this.tone('hit', 300, 0.045, 'square', -40);
          break;
        case 'BLOCK_DESTROYED':
          this.tone('break', 680, 0.09, 'triangle', 220);
          break;
        case 'SAFETY_NET_BOUNCE':
          this.tone('net', 420, 0.12, 'sine', 240);
          break;
        case 'SHIELD_ABSORBED':
          this.tone('shield', 500, 0.14, 'sine', 180);
          break;
        case 'BLOCK_EXPLODED':
          this.tone('boom', 110, 0.3, 'sawtooth', -60);
          break;
        case 'BONUS_COLLECTED':
          this.tone('bonus', 780, 0.14, 'sine', 320);
          break;
        case 'BALL_LOST':
          this.tone('ball-lost', 300, 0.08, 'sine', -80);
          break;
        case 'LIFE_LOST':
          this.tone('life-lost', 240, 0.3, 'sawtooth', -140);
          break;
        case 'LEVEL_COMPLETED':
          this.tone('win1', 523, 0.16, 'triangle');
          window.setTimeout(() => this.tone('win2', 659, 0.16, 'triangle'), 130);
          window.setTimeout(() => this.tone('win3', 784, 0.22, 'triangle'), 260);
          break;
        case 'GAME_OVER':
          this.tone('fail', 196, 0.4, 'sawtooth', -80);
          break;
        case 'BOSS_DEFEATED':
          this.tone('boss', 98, 0.5, 'sawtooth', 200);
          break;
        default:
          break;
      }
    }
  }

  dispose() {
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
}
