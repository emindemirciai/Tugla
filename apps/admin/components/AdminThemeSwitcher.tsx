'use client';

import { useEffect, useState } from 'react';
import { t } from '../lib/i18n';
import { applyTheme, readThemePreference, setThemePreference } from '../lib/theme';

/** One button, showing the mode it would switch to. */
export function AdminThemeSwitcher() {
  const [resolved, setResolved] = useState<'day' | 'night'>('day');

  useEffect(() => {
    applyTheme(readThemePreference());
    setResolved(document.documentElement.dataset.theme === 'night' ? 'night' : 'day');
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
