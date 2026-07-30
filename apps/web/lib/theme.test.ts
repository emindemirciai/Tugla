import { describe, expect, it } from 'vitest';
import { resolveTheme, themeBootstrapScript, THEME_STORAGE_KEY } from './theme';

describe('theme resolution', () => {
  it('honours an explicit choice regardless of the device', () => {
    expect(resolveTheme('day', true)).toBe('day');
    expect(resolveTheme('night', false)).toBe('night');
  });

  it('follows the device when set to system', () => {
    expect(resolveTheme('system', true)).toBe('night');
    expect(resolveTheme('system', false)).toBe('day');
  });

  it('ships a bootstrap script that cannot throw before paint', () => {
    expect(themeBootstrapScript).toContain(THEME_STORAGE_KEY);
    expect(themeBootstrapScript).toContain('catch');
    expect(themeBootstrapScript).not.toContain('\n');
  });
});
