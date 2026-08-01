'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAdminSession, useRequireStaff } from '../lib/session';
import { AdminLanguageSwitcher } from './AdminLanguageSwitcher';
import { AdminThemeSwitcher } from './AdminThemeSwitcher';
import { t } from '../lib/i18n';

const NAV = [
  { href: '/', label: t('nav.overview'), roles: null },
  {
    href: '/levels',
    label: t('nav.levels'),
    roles: ['CONTENT_EDITOR', 'GAME_ADMIN', 'SUPER_ADMIN'],
  },
  { href: '/users', label: t('nav.users'), roles: null },
  { href: '/moderation', label: t('nav.moderation'), roles: null },
  { href: '/support', label: t('nav.support'), roles: null },
  { href: '/tasks', label: t('nav.tasks'), roles: ['CONTENT_EDITOR', 'GAME_ADMIN', 'SUPER_ADMIN'] },
  {
    href: '/achievements',
    label: t('nav.achievements'),
    roles: ['CONTENT_EDITOR', 'GAME_ADMIN', 'SUPER_ADMIN'],
  },
  {
    href: '/economy',
    label: t('nav.economy'),
    roles: ['CONTENT_EDITOR', 'GAME_ADMIN', 'SUPER_ADMIN'],
  },
  { href: '/leagues', label: t('nav.leagues'), roles: null },
  { href: '/seasons', label: t('nav.seasons'), roles: ['GAME_ADMIN', 'SUPER_ADMIN'] },
  {
    href: '/announcements',
    label: t('nav.announcements'),
    roles: ['CONTENT_EDITOR', 'GAME_ADMIN', 'SUPER_ADMIN'],
  },
  { href: '/flags', label: t('nav.flags'), roles: null },
  { href: '/analytics', label: t('nav.analytics'), roles: null },
  { href: '/audit', label: t('nav.audit'), roles: null },
  { href: '/system', label: t('nav.system'), roles: null },
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
        <div className="admin-brand">
          <span className="brand-mark">◇</span>
          <div>
            <strong>{process.env.NEXT_PUBLIC_APP_NAME ?? 'Tuğla.fun'}</strong>
            <span>{t('chrome.panel')}</span>
          </div>
        </div>
        <nav>
          {NAV.filter(
            (item) => !item.roles || (item.roles as readonly string[]).includes(user.role),
          ).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? 'active' : ''}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-prefs">
          <AdminLanguageSwitcher />
          <AdminThemeSwitcher />
        </div>
        <footer>
          <span title={user.email}>
            {user.displayName}
            <small>{user.role}</small>
          </span>
          <button type="button" onClick={() => void signOut().then(() => router.push('/login'))}>
            {t('chrome.signOut')}
          </button>
        </footer>
      </aside>
      <main className="admin-main">
        <header className="admin-header">
          <h1>{title}</h1>
          <span className="admin-env">{process.env.NEXT_PUBLIC_ENVIRONMENT ?? 'development'}</span>
        </header>
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
