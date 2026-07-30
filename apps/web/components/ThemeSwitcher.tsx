'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';
import {
  applyTheme,
  readThemePreference,
  setThemePreference,
  watchSystemTheme,
  type ThemePreference,
} from '../lib/theme';

const OPTIONS: { value: ThemePreference; key: 'theme.day' | 'theme.night' | 'theme.system' }[] = [
  { value: 'day', key: 'theme.day' },
  { value: 'night', key: 'theme.night' },
  { value: 'system', key: 'theme.system' },
];

/** Three-way appearance control: daylight, night, or follow the device. */
export function ThemeSwitcher() {
  const { t } = useI18n();
  const [preference, setPreference] = useState<ThemePreference>('system');

  useEffect(() => {
    const current = readThemePreference();
    setPreference(current);
    applyTheme(current);
    return watchSystemTheme(() => applyTheme('system'));
  }, []);

  return (
    <div className="segmented" role="group" aria-label={t('theme.label')}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={preference === option.value ? 'active' : ''}
          aria-pressed={preference === option.value}
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
