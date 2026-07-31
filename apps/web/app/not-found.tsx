'use client';

import Link from 'next/link';
import { useI18n } from '../lib/i18n';

/**
 * Owning the 404 inside the App Router matters twice: players get a branded,
 * bilingual page instead of a bare default, and the build never falls back to
 * the pages-router error document.
 */
export default function NotFound() {
  const { t } = useI18n();
  return (
    <main className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">404</span>
        <h1>{t('notFound.title')}</h1>
        <p className="auth-subtitle">{t('notFound.body')}</p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/">
            {t('notFound.home')}
          </Link>
          <Link className="button" href="/play">
            {t('notFound.play')}
          </Link>
        </div>
      </div>
    </main>
  );
}
