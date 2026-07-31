'use client';

/**
 * Appearance: daylight, night, or follow the device.
 *
 * The palette lives entirely in CSS custom properties, so switching a theme is
 * one attribute on <html>. Resolution is a pure function to keep it testable,
 * and the choice is applied before first paint by a tiny inline script in the
 * layout so the page never flashes the wrong theme.
 */
export type ThemePreference = 'system' | 'day' | 'night';
export type ResolvedTheme = 'day' | 'night';

export const THEME_STORAGE_KEY = 'tugla.theme';

/** Chooses the effective theme from the stored preference and the device. */
export const resolveTheme = (
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme => {
  if (preference === 'day') return 'day';
  if (preference === 'night') return 'night';
  return systemPrefersDark ? 'night' : 'day';
};

export const readThemePreference = (): ThemePreference => {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'day' || stored === 'night' || stored === 'system') return stored;
  } catch {
    /* storage unavailable */
  }
  return 'system';
};

const systemPrefersDark = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

export const applyTheme = (preference: ThemePreference) => {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(preference, systemPrefersDark());
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved === 'night' ? 'dark' : 'light';
};

export const setThemePreference = (preference: ThemePreference) => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* ignore */
  }
  applyTheme(preference);
};

/** Keeps "system" in sync while the app is open. */
export const watchSystemTheme = (onChange: () => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = () => {
    if (readThemePreference() === 'system') onChange();
  };
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
};

/** Runs before first paint; kept dependency-free and tiny on purpose. */
export const themeBootstrapScript = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var t=p==='day'?'day':p==='night'?'night':(d?'night':'day');document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t==='night'?'dark':'light';}catch(e){document.documentElement.dataset.theme='day';}})();`;
