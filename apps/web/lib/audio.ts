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
export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastPlay = new Map<string, number>();
  enabled = true;

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
    const now = context.currentTime;
    const last = this.lastPlay.get(key) ?? 0;
    if (now - last < 0.03) return;
    this.lastPlay.set(key, now);

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
          this.tone('hit', 520, 0.05, 'square');
          break;
        case 'BLOCK_DESTROYED':
          this.tone('break', 660, 0.09, 'triangle', 180);
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
