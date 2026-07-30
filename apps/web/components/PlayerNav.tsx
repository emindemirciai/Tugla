'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { LanguageSwitcher, useI18n, type TranslationKey } from '../lib/i18n';
import { useSession } from '../lib/session';

const LINKS: { href: string; key: TranslationKey; icon: string }[] = [
  { href: '/play', key: 'hub.play', icon: '▶' },
  { href: '/progress', key: 'hub.progress', icon: '◈' },
  { href: '/leagues', key: 'hub.leagues', icon: '♜' },
  { href: '/social', key: 'hub.social', icon: '♙' },
  { href: '/shop', key: 'hub.shop', icon: '◇' },
  { href: '/inbox', key: 'hub.inbox', icon: '✉' },
  { href: '/replays', key: 'hub.replays', icon: '⟲' },
  { href: '/create', key: 'create.hubTab', icon: '✎' },
];

/**
 * Shared chrome for every signed-in screen: top bar with the brand, language
 * and sign-out, plus a scrollable tab strip that reaches all player systems.
 */
export function HubTabs() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <div className="hub-tabs" role="navigation">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={pathname === link.href ? 'page' : undefined}
          className={pathname === link.href ? 'active' : ''}
        >
          <span aria-hidden>{link.icon}</span>
          {t(link.key)}
        </Link>
      ))}
    </div>
  );
}

export function PlayerShell({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const { t } = useI18n();
  const { user, signOut } = useSession();

  return (
    <main className="hub-page" id="main">
      <a className="skip-link" href="#main">
        {t('a11y.skip')}
      </a>
      <header className="nav">
        <Link href="/play" className="brand">
          <span className="brand-mark">◇</span>
          {process.env.NEXT_PUBLIC_APP_NAME ?? 'Tuğla'}
        </Link>
        <nav className="nav-links">
          <LanguageSwitcher compact />
          <Link href="/account">{user?.displayName ?? t('hub.account')}</Link>
          <button
            type="button"
            className="button-quiet"
            onClick={() => void signOut().then(() => router.push('/'))}
          >
            {t('play.signOut')}
          </button>
        </nav>
      </header>

      <HubTabs />

      <h1 className="hub-title">{title}</h1>
      <div className="hub-content">{children}</div>
    </main>
  );
}

/** Consistent loading/error line used by every hub screen. */
export function HubStatus({ loading, error }: { loading: boolean; error: string | null }) {
  const { t } = useI18n();
  if (loading) return <p className="loading-note">{t('play.levelsLoading')}</p>;
  if (error) return <p className="banner banner-error">{error}</p>;
  return null;
}
