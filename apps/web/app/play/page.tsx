'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { GameCanvas, type CompletionSummary } from '../../components/GameCanvas';
import { gameApi, type LevelSummary, type SessionStart } from '../../lib/api';
import { cacheLevel, flushOfflineRuns, pendingOfflineRuns } from '../../lib/offline';
import { useSession } from '../../lib/session';

const LEVEL_TYPE_LABELS: Record<string, string> = {
  NORMAL: '',
  MINI_BOSS: 'MİNİ BOSS',
  WORLD_BOSS: 'DÜNYA BOSSU',
  DAILY: 'GÜNLÜK',
  COMMUNITY: 'TOPLULUK',
};

function PlayInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, signOut } = useSession();

  const [worlds, setWorlds] = useState<{ world: number; theme: string; levels: number }[]>([]);
  const [world, setWorld] = useState(1);
  const [levels, setLevels] = useState<LevelSummary[]>([]);
  const [levelsLoading, setLevelsLoading] = useState(false);
  const [session, setSession] = useState<SessionStart | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(
    params.get('verify') === 'sent'
      ? 'Doğrulama e-postası gönderildi. Gelen kutunu kontrol et.'
      : null,
  );
  const [offlineQueued, setOfflineQueued] = useState(0);

  // No guest accounts: the game requires a signed-in player.
  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    gameApi
      .worlds()
      .then((result) => setWorlds(result.items))
      .catch(() => setError('Dünyalar yüklenemedi. Bağlantını kontrol et.'));
    setOfflineQueued(pendingOfflineRuns());
    void flushOfflineRuns(0).then((count) => {
      if (count > 0) setBanner(`${count} çevrim dışı oyun senkronize edildi (sırasız ilerleme).`);
      setOfflineQueued(pendingOfflineRuns());
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLevelsLoading(true);
    gameApi
      .levels(world, 50)
      .then((result) => setLevels(result.items))
      .catch(() => setError('Bölümler yüklenemedi.'))
      .finally(() => setLevelsLoading(false));
  }, [user, world]);

  const startLevel = useCallback(async (levelId: string) => {
    setStarting(levelId);
    setError(null);
    try {
      const start = await gameApi.startSession(levelId);
      cacheLevel(start.level);
      setSession(start);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Bölüm başlatılamadı.');
    } finally {
      setStarting(null);
    }
  }, []);

  const handleExit = useCallback((_summary: CompletionSummary | null) => {
    setSession(null);
    setOfflineQueued(pendingOfflineRuns());
  }, []);

  if (loading || (!user && typeof window !== 'undefined')) {
    return (
      <main className="play-page">
        <p className="loading-note">Oturum doğrulanıyor…</p>
      </main>
    );
  }

  if (session) {
    return <GameCanvas session={session} onExit={handleExit} />;
  }

  return (
    <main className="play-page">
      <header className="nav">
        <Link href="/" className="brand">
          <span className="brand-mark">◇</span>
          {process.env.NEXT_PUBLIC_APP_NAME ?? 'Pulse'}
        </Link>
        <nav className="nav-links">
          <Link href="/account">{user?.displayName ?? 'Hesap'}</Link>
          <button
            type="button"
            className="button-quiet"
            onClick={() => void signOut().then(() => router.push('/'))}
          >
            Çıkış
          </button>
        </nav>
      </header>

      {banner && (
        <div className="banner" role="status">
          {banner}
          <button type="button" onClick={() => setBanner(null)} aria-label="Kapat">
            ×
          </button>
        </div>
      )}
      {user && !user.emailVerified && (
        <div className="banner banner-warn">
          E-postan henüz doğrulanmadı. Hesabını korumak için gelen kutundaki bağlantıyı onayla.
        </div>
      )}
      {offlineQueued > 0 && (
        <div className="banner">Senkron bekleyen {offlineQueued} çevrim dışı oyun var.</div>
      )}
      {error && <div className="banner banner-error">{error}</div>}

      <section className="world-strip" aria-label="Dünyalar">
        {worlds.map((entry) => (
          <button
            key={entry.world}
            type="button"
            className={`world-chip world-${entry.theme} ${entry.world === world ? 'active' : ''}`}
            onClick={() => setWorld(entry.world)}
          >
            <span>DÜNYA {String(entry.world).padStart(2, '0')}</span>
            <strong>{entry.theme.replace('-', ' ')}</strong>
          </button>
        ))}
      </section>

      <section className="level-grid" aria-label="Bölümler">
        {levelsLoading && <p className="loading-note">Bölümler yükleniyor…</p>}
        {!levelsLoading &&
          levels.map((level) => {
            const badge = LEVEL_TYPE_LABELS[level.type];
            return (
              <button
                key={level.id}
                type="button"
                className={`level-card level-${level.type.toLowerCase()}`}
                onClick={() => void startLevel(level.id)}
                disabled={starting !== null}
              >
                <span className="level-number">{level.index}</span>
                {badge && <span className="level-badge">{badge}</span>}
                <span className="level-name">{level.name}</span>
                <span className="level-meta">
                  ~{Math.round(level.estimatedSeconds / 60)} dk · zorluk{' '}
                  {Math.round(level.difficulty)}
                </span>
                {starting === level.id && <span className="level-starting">Başlatılıyor…</span>}
              </button>
            );
          })}
      </section>
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={null}>
      <PlayInner />
    </Suspense>
  );
}
