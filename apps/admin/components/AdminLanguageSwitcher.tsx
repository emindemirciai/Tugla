'use client';

import { locale, setLocale } from '../lib/i18n';

export function AdminLanguageSwitcher() {
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      <button
        type="button"
        className={locale === 'tr' ? 'active' : ''}
        onClick={() => setLocale('tr')}
      >
        TR
      </button>
      <button
        type="button"
        className={locale === 'en' ? 'active' : ''}
        onClick={() => setLocale('en')}
      >
        EN
      </button>
    </div>
  );
}
