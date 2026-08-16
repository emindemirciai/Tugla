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
  const { user, loading, signOut, setUser } = useSession();
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [providers, setProviders] = useState<{ provider: string }[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const changePassword = async () => {
    setSavingPassword(true);
    setMessage(null);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      // Every other device is signed out server-side; say so rather than
      // letting the player discover it on their phone later.
      setMessage(t('account.passwordChanged'));
    } catch (passwordError) {
      setMessage(
        passwordError instanceof Error ? passwordError.message : t('common.unexpectedError'),
      );
    } finally {
      setSavingPassword(false);
    }
  };

  // Seed the form once the profile arrives, and re-seed after a successful save
  // so the disabled state reflects what the server actually stored.
  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setUsername(user.username);
    setAvatarUrl(user.avatarUrl ?? '');
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    setMessage(null);
    try {
      const updated = await authApi.updateProfile({
        displayName: displayName.trim(),
        username: username.trim(),
        avatarUrl: avatarUrl.trim(),
      });
      setUser(updated);
      setMessage(t('account.profileSaved'));
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : t('common.unexpectedError'));
    } finally {
      setSavingProfile(false);
    }
  };
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
        {/*
          Name and handle are editable here; the e-mail address is not. Changing
          the address that owns an account is a verification flow, not a profile
          edit — it is shown with its state so an unverified address is obvious.
        */}
        <form
          className="profile-form"
          onSubmit={(event) => {
            event.preventDefault();
            void saveProfile();
          }}
        >
          <div className="avatar-row">
            {avatarUrl ? (
              /* A plain img on purpose: avatars come from arbitrary hosts, and
                 next/image would need every one of them allow-listed. */
              <img className="avatar" src={avatarUrl} alt="" width={64} height={64} />
            ) : (
              <span className="avatar avatar-empty" aria-hidden>
                {user.displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="avatar-controls">
              <span className="profile-label">
                <span aria-hidden>🖼️</span> {t('account.avatar')}
              </span>
              <input
                type="url"
                value={avatarUrl}
                placeholder="https://…"
                onChange={(event) => setAvatarUrl(event.target.value)}
                maxLength={500}
              />
              <small className="profile-hint">
                {user.ownAvatar ? t('account.avatarOwn') : t('account.avatarProvider')}
              </small>
              {user.ownAvatar && (
                <button type="button" className="button-quiet" onClick={() => setAvatarUrl('')}>
                  {t('account.avatarReset')}
                </button>
              )}
            </div>
          </div>

          <label className="profile-field">
            <span className="profile-label">
              <span aria-hidden>👤</span> {t('account.displayName')}
            </span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              minLength={2}
              maxLength={40}
              required
            />
            <small className="profile-hint">{t('account.displayNameHint')}</small>
          </label>

          <label className="profile-field">
            <span className="profile-label">
              <span aria-hidden>@</span> {t('account.username')}
            </span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              minLength={3}
              maxLength={24}
              pattern="[a-z0-9][a-z0-9._\-]*[a-z0-9]"
              required
            />
            <small className="profile-hint">{t('account.usernameHint')}</small>
          </label>

          {/*
            The address is shown, never edited. Changing the address that owns an
            account is a verification flow, and a field that looks editable but
            silently is not would be worse than a locked one that says why.
          */}
          <div className="profile-field">
            <span className="profile-label">
              <span aria-hidden>✉️</span> {t('account.email')}
            </span>
            <input value={user.email} readOnly disabled aria-describedby="email-locked" />
            <small className="profile-hint profile-locked" id="email-locked">
              <span aria-hidden>🔒</span> {t('account.emailLocked')}
            </small>
            <div className="profile-email-state">
              {user.emailVerified ? (
                <span className="tag tag-ok">{t('account.verified')}</span>
              ) : (
                <>
                  <span className="tag tag-review">{t('account.notVerified')}</span>
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
                </>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="button button-primary profile-save"
            disabled={
              savingProfile ||
              (displayName.trim() === user.displayName &&
                username.trim() === user.username &&
                avatarUrl.trim() === (user.avatarUrl ?? ''))
            }
          >
            {savingProfile ? t('common.processing') : t('account.saveProfile')}
          </button>
        </form>
      </section>

      <section className="account-section">
        <h2>{t('account.password')}</h2>
        <form
          className="profile-form"
          onSubmit={(event) => {
            event.preventDefault();
            void changePassword();
          }}
        >
          <label className="profile-field">
            <span className="profile-label">
              <span aria-hidden>🔒</span> {t('account.currentPassword')}
            </span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label className="profile-field">
            <span className="profile-label">
              <span aria-hidden>🔑</span> {t('account.newPassword')}
            </span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={10}
              required
            />
            <small className="profile-hint">{t('account.newPasswordHint')}</small>
          </label>
          <button
            type="submit"
            className="button button-primary profile-save"
            disabled={savingPassword || !currentPassword || newPassword.length < 10}
          >
            {savingPassword ? t('common.processing') : t('account.savePassword')}
          </button>
        </form>
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
