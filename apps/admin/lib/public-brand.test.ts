import { describe, expect, it } from 'vitest';
import { publicAppName } from './public-brand';

describe('admin public brand', () => {
  it('upgrades the legacy display name and preserves custom brands', () => {
    expect(publicAppName()).toBe('Tuğla.fun');
    expect(publicAppName('Tuğla')).toBe('Tuğla.fun');
    expect(publicAppName('Example Admin')).toBe('Example Admin');
  });
});
