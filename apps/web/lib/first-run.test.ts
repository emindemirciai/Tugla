import { describe, expect, it } from 'vitest';
import { dictionaries } from './i18n';

/**
 * The first-run card is the only explanation a new player gets, so its copy is
 * held to the same bilingual contract as everything else — and to a length
 * limit, because guidance nobody finishes reading is guidance nobody has.
 */
describe('first-run guidance', () => {
  const keys = [
    'firstRun.title',
    'firstRun.controlTitle',
    'firstRun.controlBody',
    'firstRun.goalTitle',
    'firstRun.goalBody',
    'firstRun.progressTitle',
    'firstRun.progressBody',
  ] as const;

  it('exists in both languages', () => {
    for (const key of keys) {
      expect(dictionaries.tr[key]?.length ?? 0).toBeGreaterThan(0);
      expect(dictionaries.en[key]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('is actually translated rather than copied', () => {
    for (const key of keys) {
      expect(dictionaries.tr[key], key).not.toBe(dictionaries.en[key]);
    }
  });

  it('keeps each step short enough to be read', () => {
    for (const key of keys) {
      expect(dictionaries.tr[key].length, `tr:${key}`).toBeLessThan(220);
      expect(dictionaries.en[key].length, `en:${key}`).toBeLessThan(220);
    }
  });
});
