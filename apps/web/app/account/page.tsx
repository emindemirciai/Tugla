'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authApi } from '../../lib/api';
import { useSession } from '../../lib/session';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import { LanguageSwitcher, useI18n } from '../../lib/i18n';

interface DeviceSession {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  createdAt: string;
  current: boolean;
}

/** Account centre: verification, sessions, providers, export, deletion. */
export default function AccountPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { user, loading, signOut } = useSession();
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [providers, setProviders] = useState<{ provider: string }[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    void authApi
      .sessions()
      .then((result) => setSessions(result.items as unknown as DeviceSession[]));
    void authApi
      .me()
      .then(() => authApi.sessions())
      .catch(() => undefined);
    void fetchProviders();
  }, [user]);

  const fetchProviders = async () => {
    try {
      const result = (await import('../../lib/api').then((module) =>
        module.api<{ items: { provider: string }[] }>('/auth/providers'),
      )) as { items: { provider: string }[] };
      setProviders(result.items);
    } catch {
      /* provider list is non-critical */
    }
  };

  if (loading || !user) return <main className="account-page" />;

  const exportData = async () => {
    setBusy(true);
    try {
      const data = await authApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${user.username}-export.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(t('account.exportDone'));
    } catch {
      setMessage(t('account.exportFailed'));
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (confirmDelete !== user.username) return;
    setBusy(true);
    try {
      await authApi.deleteAccount();
      await signOut();
      router.push('/');
    } catch {
      setMessage(t('account.deleteFailed'));
      setBusy(false);
    }
  };

  return (
    <main className="account-page">
      <header className="nav">
        <Link href="/play" className="brand">
          {t('account.backToGame')}
        </Link>
      </header>

      <h1>{t('account.title')}</h1>
      {message && <div className="banner">{message}</div>}

      <section className="account-section">
        <h2>{t('account.profile')}</h2>
        <dl className="account-facts">
          <dt>{t('account.displayName')}</dt>
          <dd>{user.displayName}</dd>
          <dt>{t('account.username')}</dt>
          <dd>@{user.username}</dd>
          <dt>{t('account.email')}</dt>
          <dd>
            {user.email}{' '}
            {user.emailVerified ? (
              <span className="tag tag-ok">{t('account.verified')}</span>
            ) : (
              <button
                type="button"
                className="button-quiet"
                onClick={() =>
                  void authApi
                    .requestVerification(user.email)
                    .then((result) =>
                      setMessage(
                        result.sent
                          ? t('account.verificationSent')
                          : t('account.verificationUnavailable'),
                      ),
                    )
                }
              >
                {t('account.sendVerification')}
              </button>
            )}
          </dd>
        </dl>
      </section>

      <section className="account-section">
        <h2>{t('account.providers')}</h2>
        <p className="muted">
          {providers.length
            ? providers.map((entry) => entry.provider).join(', ')
            : t('account.providersNone')}{' '}
          {t('account.providersNote')}
        </p>
      </section>

      <section className="account-section">
        <h2>{t('theme.label')}</h2>
        <ThemeSwitcher />
        <p className="muted">{t('theme.note')}</p>
      </section>

      <section className="account-section">
        <h2>{t('account.language')}</h2>
        <LanguageSwitcher />
        <p className="muted">{t('account.languageNote')}</p>
      </section>

      <section className="account-section">
        <h2>{t('account.sessions')}</h2>
        <ul className="session-list">
          {sessions.map((entry) => (
            <li key={entry.id}>
              <div>
                <strong>{entry.deviceName ?? t('account.unknownDevice')}</strong>
                <span className="muted">
                  {entry.ipAddress ?? ''} · {new Date(entry.createdAt).toLocaleString(locale)}
                  {entry.current ? ` · ${t('account.thisDevice')}` : ''}
                </span>
              </div>
              {!entry.current && (
                <button
                  type="button"
                  className="button-quiet"
                  onClick={() =>
                    void authApi
                      .revokeSession(entry.id)
                      .then(() =>
                        authApi
                          .sessions()
                          .then((result) =>
                            setSessions(result.items as unknown as DeviceSession[]),
                          ),
                      )
                  }
                >
                  {t('account.revoke')}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="account-section">
        <h2>{t('account.data')}</h2>
        <button type="button" className="button" onClick={() => void exportData()} disabled={busy}>
          {t('account.export')}
        </button>
      </section>

      <section className="account-section danger">
        <h2>{t('account.delete')}</h2>
        <p className="muted">
          {t('account.deleteWarning')} <strong>{user.username}</strong>
        </p>
        <div className="danger-row">
          <input
            value={confirmDelete}
            onChange={(event) => setConfirmDelete(event.target.value)}
            placeholder={user.username}
            aria-label={t('account.deleteConfirmAria')}
          />
          <button
            type="button"
            className="button button-danger"
            disabled={confirmDelete !== user.username || busy}
            onClick={() => void deleteAccount()}
          >
            {t('account.deleteButton')}
          </button>
        </div>
      </section>
    </main>
  );
}
