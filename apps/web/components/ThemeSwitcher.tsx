'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';
import {
  applyTheme,
  readThemePreference,
  setThemePreference,
  watchSystemTheme,
} from '../lib/theme';

/**
 * Appearance toggle.
 *
 * A three-way "Day / Night / Device" control asked the player to think about a
 * setting they only ever want to flip. This is one button: it shows the mode you
 * would switch *to*, and the first press adopts whatever the device was already
 * doing as the starting point.
 */
export function ThemeSwitcher() {
  const { t } = useI18n();
  const [resolved, setResolved] = useState<'day' | 'night'>('day');

  useEffect(() => {
    const preference = readThemePreference();
    applyTheme(preference);
    const current = () =>
      (document.documentElement.dataset.theme === 'night' ? 'night' : 'day') as 'day' | 'night';
    setResolved(current());
    return watchSystemTheme(() => {
      applyTheme('system');
      setResolved(current());
    });
  }, []);

  const next = resolved === 'night' ? 'day' : 'night';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => {
        setThemePreference(next);
        setResolved(next);
      }}
      aria-label={t(next === 'night' ? 'theme.toNight' : 'theme.toDay')}
      title={t(next === 'night' ? 'theme.toNight' : 'theme.toDay')}
    >
      <span aria-hidden>{next === 'night' ? '☾' : '☀'}</span>
    </button>
  );
}
