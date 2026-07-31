'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useI18n } from '../lib/i18n';

/** Client error boundary: recoverable by retrying the failed render. */
export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    // Surfaced in the browser console and picked up by Sentry when configured.
    console.error(error);
  }, [error]);

  return (
    <main className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">500</span>
        <h1>{t('error.title')}</h1>
        <p className="auth-subtitle">{t('error.body')}</p>
        <div className="hero-actions">
          <button type="button" className="button button-primary" onClick={reset}>
            {t('error.retry')}
          </button>
          <Link className="button" href="/">
            {t('notFound.home')}
          </Link>
        </div>
      </div>
    </main>
  );
}
