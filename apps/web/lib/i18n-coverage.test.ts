import { describe, expect, it } from 'vitest';
import { dictionaries } from './i18n';

/**
 * TR/EN coverage.
 *
 * Every user-visible string in this app goes through the dictionary, so a key
 * that exists in one language and not the other is a shipped bug: the player
 * would see a raw key. These checks run on every commit.
 */
describe('Turkish and English stay in step', () => {
  it('defines exactly the same keys in both languages', () => {
    const tr = Object.keys(dictionaries.tr).sort();
    const en = Object.keys(dictionaries.en).sort();
    expect(en).toEqual(tr);
  });

  it('never ships an empty or placeholder translation', () => {
    for (const locale of ['tr', 'en'] as const) {
      for (const [key, value] of Object.entries(dictionaries[locale])) {
        expect(value.trim(), `${locale}:${key}`).not.toHaveLength(0);
        expect(value, `${locale}:${key}`).not.toMatch(/^TODO/i);
      }
    }
  });

  it('keeps the same interpolation variables in both languages', () => {
    const variables = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(dictionaries.tr) as (keyof typeof dictionaries.tr)[]) {
      expect(variables(dictionaries.en[key]), `variables differ for ${key}`).toEqual(
        variables(dictionaries.tr[key]),
      );
    }
  });

  it('covers the screens added most recently', () => {
    for (const key of [
      'game.hud.time',
      'play.level.locked',
      'create.title',
      'daily.title',
      'theme.label',
      'auth.verify.codeTitle',
    ] as const) {
      expect(dictionaries.tr[key]?.length ?? 0).toBeGreaterThan(0);
      expect(dictionaries.en[key]?.length ?? 0).toBeGreaterThan(0);
      // A Turkish string that equals the English one usually means a forgotten
      // translation rather than a deliberate shared term.
      if (!['theme.label'].includes(key)) {
        expect(dictionaries.tr[key]).not.toBe(dictionaries.en[key]);
      }
    }
  });
});
