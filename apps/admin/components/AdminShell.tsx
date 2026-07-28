'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAdminSession, useRequireStaff } from '../lib/session';

const NAV = [
  { href: '/', label: 'Genel bakış', roles: null },
  {
    href: '/levels',
    label: 'Bölümler ve dünyalar',
    roles: ['CONTENT_EDITOR', 'GAME_ADMIN', 'SUPER_ADMIN'],
  },
  { href: '/users', label: 'Kullanıcılar', roles: null },
  { href: '/moderation', label: 'Moderasyon', roles: null },
  { href: '/support', label: 'Destek talepleri', roles: null },
  { href: '/tasks', label: 'Görevler', roles: ['CONTENT_EDITOR', 'GAME_ADMIN', 'SUPER_ADMIN'] },
  {
    href: '/achievements',
    label: 'Başarımlar',
    roles: ['CONTENT_EDITOR', 'GAME_ADMIN', 'SUPER_ADMIN'],
  },
  {
    href: '/economy',
    label: 'Mağaza ve ekonomi',
    roles: ['CONTENT_EDITOR', 'GAME_ADMIN', 'SUPER_ADMIN'],
  },
  { href: '/leagues', label: 'Ligler', roles: null },
  { href: '/seasons', label: 'Sezonlar', roles: ['GAME_ADMIN', 'SUPER_ADMIN'] },
  {
    href: '/announcements',
    label: 'Duyurular',
    roles: ['CONTENT_EDITOR', 'GAME_ADMIN', 'SUPER_ADMIN'],
  },
  { href: '/flags', label: 'Feature flags', roles: null },
  { href: '/analytics', label: 'Analitik', roles: null },
  { href: '/audit', label: 'Audit log', roles: null },
  { href: '/system', label: 'Sistem sağlığı', roles: null },
] as const;

/** Panel chrome: every sidebar entry is a real route with a real page. */
export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const { user, loading } = useRequireStaff();
  const { signOut } = useAdminSession();
  const pathname = usePathname();
  const router = useRouter();

  if (loading) return <div className="admin-loading">Oturum doğrulanıyor…</div>;
  if (!user) return null;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="brand-mark">◇</span>
          <div>
            <strong>{process.env.NEXT_PUBLIC_APP_NAME ?? 'Pulse'}</strong>
            <span>YÖNETİM</span>
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
        <footer>
          <span title={user.email}>
            {user.displayName}
            <small>{user.role}</small>
          </span>
          <button type="button" onClick={() => void signOut().then(() => router.push('/login'))}>
            Çıkış
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
