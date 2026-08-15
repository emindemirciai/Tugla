import { describe, expect, it } from 'vitest';
import { shouldPlay, SOUND_INTERVAL_MS } from './audio';

/**
 * The rate limiter used to run on the audio clock. A suspended AudioContext
 * keeps that clock at zero, so every sound compared 0 against 0, the guard
 * rejected all of them, and a level started in silence. These tests pin the
 * behaviour to an injected wall clock.
 */
describe('sound rate limiting', () => {
  it('plays the first sound of a kind', () => {
    expect(shouldPlay(new Map(), 'hit', 0)).toBe(true);
  });

  it('never blocks on a clock that is standing still', () => {
    const last = new Map<string, number>();
    // Two different sounds at the same instant: both must be heard.
    expect(shouldPlay(last, 'hit', 0)).toBe(true);
    expect(shouldPlay(last, 'break', 0)).toBe(true);
  });

  it('collapses a burst of the same sound', () => {
    const last = new Map<string, number>();
    expect(shouldPlay(last, 'hit', 100)).toBe(true);
    expect(shouldPlay(last, 'hit', 100 + SOUND_INTERVAL_MS - 1)).toBe(false);
    expect(shouldPlay(last, 'hit', 100 + SOUND_INTERVAL_MS)).toBe(true);
  });

  it('keeps each kind on its own budget', () => {
    const last = new Map<string, number>();
    shouldPlay(last, 'hit', 0);
    expect(shouldPlay(last, 'break', 1)).toBe(true);
  });
});
