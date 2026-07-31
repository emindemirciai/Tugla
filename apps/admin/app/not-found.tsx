'use client';

import Link from 'next/link';
import { t } from '../lib/i18n';

export default function NotFound() {
  return (
    <main className="admin-login">
      <div className="admin-login-card">
        <span className="admin-env">404</span>
        <h1>{t('notFound.title')}</h1>
        <p className="admin-note">{t('notFound.body')}</p>
        <Link className="button" href="/">
          {t('notFound.home')}
        </Link>
      </div>
    </main>
  );
}
