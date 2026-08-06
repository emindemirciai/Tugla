import { describe, expect, it } from 'vitest';
import { dictionaries } from './i18n';

/** The control centre carries the same TR/EN guarantee as the player app. */
describe('admin dictionary parity', () => {
  it('defines the same keys in both languages', () => {
    expect(Object.keys(dictionaries.en).sort()).toEqual(Object.keys(dictionaries.tr).sort());
  });

  it('never ships an empty translation', () => {
    for (const locale of ['tr', 'en'] as const) {
      for (const [key, value] of Object.entries(dictionaries[locale])) {
        expect(value.trim(), `${locale}:${key}`).not.toHaveLength(0);
      }
    }
  });

  it('keeps interpolation variables identical', () => {
    const variables = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(dictionaries.tr) as (keyof typeof dictionaries.tr)[]) {
      expect(variables(dictionaries.en[key]), `variables differ for ${key}`).toEqual(
        variables(dictionaries.tr[key]),
      );
    }
  });
});
