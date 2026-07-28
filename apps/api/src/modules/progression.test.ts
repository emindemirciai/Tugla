import { describe, expect, it } from 'vitest';
import { dayKey, experienceForLevel, periodKeyFor, weekKey } from './progression';

describe('progression period keys', () => {
  it('produces ISO week keys that roll over on Mondays', () => {
    expect(weekKey(new Date('2026-01-05T10:00:00Z'))).toBe('2026-W02');
    expect(weekKey(new Date('2026-01-04T10:00:00Z'))).toBe('2026-W01');
  });

  it('buckets tasks by cadence', () => {
    const date = new Date('2026-07-15T12:00:00Z');
    expect(periodKeyFor('DAILY', date)).toBe(dayKey(date));
    expect(periodKeyFor('WEEKLY', date)).toBe(weekKey(date));
    expect(periodKeyFor('SEASONAL', date)).toBe('S2026-3');
    expect(periodKeyFor('PERMANENT', date)).toBe('PERMANENT');
  });

  it('makes each player level cost more than the last', () => {
    expect(experienceForLevel(2)).toBeGreaterThan(experienceForLevel(1));
    expect(experienceForLevel(10)).toBeGreaterThan(experienceForLevel(9));
  });
});
