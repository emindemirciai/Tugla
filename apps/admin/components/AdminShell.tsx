'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAdminSession, useRequireStaff } from '../lib/session';
import { AdminLanguageSwitcher } from './AdminLanguageSwitcher';
import { AdminThemeSwitcher } from './AdminThemeSwitcher';
import { t } from '../lib/i18n';

const NAV = [
  { href: '/', icon: '🏠', label: t('nav.overview'), roles: null },
  {
    href: '/levels',
    icon: '🧱',
    label: t('nav.levels'),
    roles: ['CONTENT_EDITOR', 'GAME_ADMIN', 'SUPER_ADMIN'],
  },
  { href: '/users', icon: '👥', label: t('nav.users'), roles: null },
  { href: '/moderation', icon: '🚩', label: t('nav.moderation'), roles: null },
  { href: '/support', icon: '✉️', label: t('nav.support'), roles: null },
  {
    href: '/tasks',
    icon: '🎯',
    label: t('nav.tasks'),
    roles: ['CONTENT_EDITOR', 'GAME_ADMIN', 'SUPER_ADMIN'],
  },
  {
    href: '/achievements',
    icon: '🏆',
    label: t('nav.achievements'),
    roles: ['CONTENT_EDITOR', 'GAME_ADMIN', 'SUPER_ADMIN'],
  },
  {
    href: '/economy',
    icon: '🛒',
    label: t('nav.economy'),
    roles: ['CONTENT_EDITOR', 'GAME_ADMIN', 'SUPER_ADMIN'],
  },
  { href: '/leagues', icon: '📊', label: t('nav.leagues'), roles: null },
  { href: '/seasons', icon: '🗓️', label: t('nav.seasons'), roles: ['GAME_ADMIN', 'SUPER_ADMIN'] },
  {
    href: '/announcements',
    icon: '📣',
    label: t('nav.announcements'),
    roles: ['CONTENT_EDITOR', 'GAME_ADMIN', 'SUPER_ADMIN'],
  },
  { href: '/flags', icon: '🎛️', label: t('nav.flags'), roles: null },
  { href: '/analytics', icon: '📈', label: t('nav.analytics'), roles: null },
  { href: '/messages', icon: '💬', label: t('nav.messages'), roles: null },
  { href: '/audit', icon: '📜', label: t('nav.audit'), roles: null },
  { href: '/system', icon: '🩺', label: t('nav.system'), roles: null },
] as const;

/** Panel chrome: every sidebar entry is a real route with a real page. */
export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const { user, loading } = useRequireStaff();
  const { signOut } = useAdminSession();
  const pathname = usePathname();
  const router = useRouter();

  if (loading) return <div className="admin-loading">{t('chrome.checkingSession')}</div>;
  if (!user) return null;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        {/* The brand is a link home: it is where people click to get out of a
            screen, and a dead logo makes them hunt for the overview instead. */}
        <Link href="/" className="admin-brand">
          <span className="brand-mark">◇</span>
          <div>
            <strong>{process.env.NEXT_PUBLIC_APP_NAME ?? 'Tuğla.fun'}</strong>
            <span>{t('chrome.panel')}</span>
          </div>
        </Link>
        <nav>
          {NAV.filter(
            (item) => !item.roles || (item.roles as readonly string[]).includes(user.role),
          ).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? 'active' : ''}
            >
              {/* Same icon as the overview card for this destination: the two
                  screens should teach one vocabulary, not two. */}
              <span className="nav-icon" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-prefs">
          <AdminLanguageSwitcher />
          <AdminThemeSwitcher />
        </div>
        <footer>
          {/* Name above, role below: as one inline span the two ran together
              and read as "Emin DEMİRCİSUPER_ADMIN". */}
          <span className="admin-identity" title={user.email}>
            <strong>{user.displayName}</strong>
            <small>{user.role}</small>
          </span>
          <button type="button" onClick={() => void signOut().then(() => router.push('/login'))}>
            {t('chrome.signOut')}
          </button>
        </footer>
        <p className="admin-version" title={t('chrome.version')}>
          v{process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'}
        </p>
      </aside>
      <main className="admin-main">
        <header className="admin-header">
          <h1>{title}</h1>
        </header>
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
