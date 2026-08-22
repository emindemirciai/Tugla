import { describe, expect, it } from 'vitest';
import { cosmeticColour } from '../components/GameRenderer';

/**
 * Catalogue metadata is free-form JSON typed by staff in the admin panel, so it
 * is untrusted input reaching a renderer. A malformed shop item must look like
 * nothing happened rather than break the game.
 */
describe('cosmetic colours', () => {
  it('reads a valid hex colour', () => {
    expect(
      cosmeticColour([{ sku: 'a', category: 'trail', metadata: { color: '#ff8800' } }], 'trail'),
    ).toBe(0xff8800);
  });

  it('ignores a cosmetic from another category', () => {
    expect(
      cosmeticColour([{ sku: 'a', category: 'paddle', metadata: { color: '#ff8800' } }], 'trail'),
    ).toBeNull();
  });

  it.each([
    ['missing metadata', undefined],
    ['a string instead of an object', 'red'],
    ['a colour name', { color: 'red' }],
    ['a short hex', { color: '#f80' }],
    ['a number', { color: 0xff8800 }],
    ['an injection attempt', { color: '#ff8800; drop table' }],
  ])('ignores %s', (_label, metadata) => {
    expect(cosmeticColour([{ sku: 'a', category: 'trail', metadata }], 'trail')).toBeNull();
  });

  it('returns null when nothing is equipped', () => {
    expect(cosmeticColour([], 'trail')).toBeNull();
  });
});
