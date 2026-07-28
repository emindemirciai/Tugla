'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authApi } from '../../lib/api';
import { useSession } from '../../lib/session';

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
  const { user, loading, refresh, signOut } = useSession();
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
    void authApi.sessions().then((result) => setSessions(result.items as unknown as DeviceSession[]));
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
      setMessage('Verilerin JSON olarak indirildi.');
    } catch {
      setMessage('Dışa aktarma başarısız oldu.');
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
      setMessage('Hesap silme başarısız oldu.');
      setBusy(false);
    }
  };

  return (
    <main className="account-page">
      <header className="nav">
        <Link href="/play" className="brand">
          ← Oyuna dön
        </Link>
      </header>

      <h1>Hesap</h1>
      {message && <div className="banner">{message}</div>}

      <section className="account-section">
        <h2>Profil</h2>
        <dl className="account-facts">
          <dt>Görünen ad</dt>
          <dd>{user.displayName}</dd>
          <dt>Kullanıcı adı</dt>
          <dd>@{user.username}</dd>
          <dt>E-posta</dt>
          <dd>
            {user.email}{' '}
            {user.emailVerified ? (
              <span className="tag tag-ok">doğrulandı</span>
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
                          ? 'Doğrulama e-postası gönderildi.'
                          : 'E-posta servisi yapılandırılmadığı için gönderilemedi.',
                      ),
                    )
                }
              >
                doğrulama bağlantısı gönder
              </button>
            )}
          </dd>
        </dl>
      </section>

      <section className="account-section">
        <h2>Bağlı sağlayıcılar</h2>
        <p className="muted">
          {providers.length
            ? providers.map((entry) => entry.provider).join(', ')
            : 'Yalnızca e-posta + parola.'}{' '}
          Google/Apple bağlama, sağlayıcı anahtarları yapılandırıldığında giriş ekranında görünür.
        </p>
      </section>

      <section className="account-section">
        <h2>Aktif oturumlar</h2>
        <ul className="session-list">
          {sessions.map((entry) => (
            <li key={entry.id}>
              <div>
                <strong>{entry.deviceName ?? 'Bilinmeyen cihaz'}</strong>
                <span className="muted">
                  {entry.ipAddress ?? ''} · {new Date(entry.createdAt).toLocaleString('tr-TR')}
                  {entry.current ? ' · bu cihaz' : ''}
                </span>
              </div>
              {!entry.current && (
                <button
                  type="button"
                  className="button-quiet"
                  onClick={() =>
                    void authApi.revokeSession(entry.id).then(() =>
                      authApi.sessions().then((result) =>
                        setSessions(result.items as unknown as DeviceSession[]),
                      ),
                    )
                  }
                >
                  Sonlandır
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="account-section">
        <h2>Verilerin</h2>
        <button type="button" className="button" onClick={() => void exportData()} disabled={busy}>
          Tüm verilerimi indir (JSON)
        </button>
      </section>

      <section className="account-section danger">
        <h2>Hesabı sil</h2>
        <p className="muted">
          Bu işlem geri alınamaz: kişisel verilerin anında temizlenir, skorların anonimleşir. Onaylamak
          için kullanıcı adını yaz: <strong>{user.username}</strong>
        </p>
        <div className="danger-row">
          <input
            value={confirmDelete}
            onChange={(event) => setConfirmDelete(event.target.value)}
            placeholder={user.username}
            aria-label="Silme onayı"
          />
          <button
            type="button"
            className="button button-danger"
            disabled={confirmDelete !== user.username || busy}
            onClick={() => void deleteAccount()}
          >
            Hesabı kalıcı olarak sil
          </button>
        </div>
      </section>
    </main>
  );
}
