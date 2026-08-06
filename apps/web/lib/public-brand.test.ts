import { describe, expect, it } from 'vitest';
import { DEFAULT_PUBLIC_APP_NAME, publicAppName } from './public-brand';

describe('public app name', () => {
  it('uses the domain-qualified brand by default', () => {
    expect(publicAppName()).toBe(DEFAULT_PUBLIC_APP_NAME);
    expect(publicAppName('  ')).toBe('Tuğla.fun');
  });

  it('upgrades legacy production values without blocking real rebrands', () => {
    expect(publicAppName('Tuğla')).toBe('Tuğla.fun');
    expect(publicAppName('TUGLA')).toBe('Tuğla.fun');
    expect(publicAppName('Example Arcade')).toBe('Example Arcade');
  });
});
