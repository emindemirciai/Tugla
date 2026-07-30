'use client';

/**
 * Control-centre appearance. Mirrors the player app: daylight, night or the
 * device preference, applied as a data attribute so the whole palette switches
 * from one place.
 */
export type ThemePreference = 'system' | 'day' | 'night';

export const THEME_STORAGE_KEY = 'tugla.admin.theme';

export const resolveTheme = (preference: ThemePreference, systemPrefersDark: boolean) =>
  preference === 'day'
    ? 'day'
    : preference === 'night'
      ? 'night'
      : systemPrefersDark
        ? 'night'
        : 'day';

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

export const applyTheme = (preference: ThemePreference) => {
  if (typeof document === 'undefined') return;
  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = resolveTheme(preference, prefersDark);
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

export const themeBootstrapScript = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var t=p==='day'?'day':p==='night'?'night':(d?'night':'day');document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t==='night'?'dark':'light';}catch(e){document.documentElement.dataset.theme='day';}})();`;
