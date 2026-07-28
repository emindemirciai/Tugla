import { describe, expect, it } from 'vitest';
import { defaultSettings, resolveQuality } from './settings';

describe('graphics quality resolution', () => {
  it('supports the four required tiers', () => {
    expect(resolveQuality('LOW').level).toBe('LOW');
    expect(resolveQuality('MEDIUM').level).toBe('MEDIUM');
    expect(resolveQuality('HIGH').level).toBe('HIGH');
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(resolveQuality('AUTO').level);
  });

  it('scales expensive effects down with the tier', () => {
    const low = resolveQuality('LOW');
    const high = resolveQuality('HIGH');
    expect(low.shadows).toBe(false);
    expect(high.shadows).toBe(true);
    expect(low.maxParticles).toBeLessThan(high.maxParticles);
    expect(low.trailLength).toBeLessThan(high.trailLength);
  });

  it('defaults to AUTO with sound on', () => {
    expect(defaultSettings.quality).toBe('AUTO');
    expect(defaultSettings.soundEnabled).toBe(true);
  });
});
