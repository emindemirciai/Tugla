import { describe, expect, it } from 'vitest';
import { dictionaries } from './i18n';

describe('TR/EN dictionary parity', () => {
  it('has identical key sets in both languages', () => {
    const trKeys = Object.keys(dictionaries.tr).sort();
    const enKeys = Object.keys(dictionaries.en).sort();
    expect(enKeys).toEqual(trKeys);
  });

  it('never ships an empty translation', () => {
    for (const locale of ['tr', 'en'] as const) {
      for (const [key, value] of Object.entries(dictionaries[locale])) {
        expect(value.trim(), `${locale}:${key}`).not.toHaveLength(0);
      }
    }
  });
});
