'use client';

import { useEffect, useState } from 'react';
import { t } from '../lib/i18n';
import {
  applyTheme,
  readThemePreference,
  setThemePreference,
  type ThemePreference,
} from '../lib/theme';

const OPTIONS: { value: ThemePreference; key: 'theme.day' | 'theme.night' | 'theme.system' }[] = [
  { value: 'day', key: 'theme.day' },
  { value: 'night', key: 'theme.night' },
  { value: 'system', key: 'theme.system' },
];

export function AdminThemeSwitcher() {
  const [preference, setPreference] = useState<ThemePreference>('system');

  useEffect(() => {
    const current = readThemePreference();
    setPreference(current);
    applyTheme(current);
  }, []);

  return (
    <div className="lang-switch" role="group" aria-label={t('theme.label')}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={preference === option.value}
          className={preference === option.value ? 'active' : ''}
          onClick={() => {
            setPreference(option.value);
            setThemePreference(option.value);
          }}
        >
          {t(option.key)}
        </button>
      ))}
    </div>
  );
}
