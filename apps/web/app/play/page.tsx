'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { GameCanvas, type CompletionSummary } from '../../components/GameCanvas';
import { HubTabs } from '../../components/PlayerNav';
import { gameApi, type LevelSummary, type SessionStart } from '../../lib/api';
import { cacheLevel, flushOfflineRuns, pendingOfflineRuns } from '../../lib/offline';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useSession } from '../../lib/session';

const LEVEL_TYPE_KEYS: Record<string, TranslationKey | ''> = {
  NORMAL: '',
  MINI_BOSS: 'play.badge.miniBoss',
  WORLD_BOSS: 'play.badge.worldBoss',
  DAILY: 'play.badge.daily',
  COMMUNITY: 'play.badge.community',
};

function PlayInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const { user, loading, signOut } = useSession();

  const [worlds, setWorlds] = useState<{ world: number; theme: string; levels: number }[]>([]);
  const [world, setWorld] = useState(1);
  const [levels, setLevels] = useState<LevelSummary[]>([]);
  const [levelsLoading, setLevelsLoading] = useState(false);
  const [session, setSession] = useState<SessionStart | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(
    params.get('verify') === 'sent' ? t('play.banner.verifySent') : null,
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
      .catch(() => setError(t('play.error.worlds')));
    setOfflineQueued(pendingOfflineRuns());
    void flushOfflineRuns(0).then((count) => {
      if (count > 0) setBanner(t('play.banner.offlineSynced', { count }));
      setOfflineQueued(pendingOfflineRuns());
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLevelsLoading(true);
    gameApi
      .levels(world, 50)
      .then((result) => setLevels(result.items))
      .catch(() => setError(t('play.error.levels')))
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
      setError(startError instanceof Error ? startError.message : t('play.error.start'));
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
        <p className="loading-note">{t('play.checkingSession')}</p>
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
          {process.env.NEXT_PUBLIC_APP_NAME ?? 'Tuğla'}
        </Link>
        <nav className="nav-links">
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

      {banner && (
        <div className="banner" role="status">
          {banner}
          <button type="button" onClick={() => setBanner(null)} aria-label={t('common.close')}>
            ×
          </button>
        </div>
      )}
      {user && !user.emailVerified && (
        <div className="banner banner-warn">{t('play.banner.unverified')}</div>
      )}
      {offlineQueued > 0 && (
        <div className="banner">{t('play.banner.offlineQueued', { count: offlineQueued })}</div>
      )}
      {error && <div className="banner banner-error">{error}</div>}

      <HubTabs />

      <section className="world-strip" aria-label={t('play.worldsAria')}>
        {worlds.map((entry) => (
          <button
            key={entry.world}
            type="button"
            className={`world-chip world-${entry.theme} ${entry.world === world ? 'active' : ''}`}
            onClick={() => setWorld(entry.world)}
          >
            <span>
              {t('play.world')} {String(entry.world).padStart(2, '0')}
            </span>
            <strong>{entry.theme.replace('-', ' ')}</strong>
          </button>
        ))}
      </section>

      <section className="level-grid" aria-label={t('play.levelsAria')}>
        {levelsLoading && <p className="loading-note">{t('play.levelsLoading')}</p>}
        {!levelsLoading &&
          levels.map((level) => {
            const badgeKey = LEVEL_TYPE_KEYS[level.type];
            return (
              <button
                key={level.id}
                type="button"
                className={`level-card level-${level.type.toLowerCase()}`}
                onClick={() => void startLevel(level.id)}
                disabled={starting !== null}
              >
                <span className="level-number">{level.index}</span>
                {badgeKey && <span className="level-badge">{t(badgeKey)}</span>}
                <span className="level-name">{level.name}</span>
                <span className="level-meta">
                  {t('play.level.minutes', {
                    minutes: Math.round(level.estimatedSeconds / 60),
                    difficulty: Math.round(level.difficulty),
                  })}
                </span>
                {starting === level.id && (
                  <span className="level-starting">{t('play.level.starting')}</span>
                )}
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
