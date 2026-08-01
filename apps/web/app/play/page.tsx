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
  const { t, locale } = useI18n();
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
  const [daily, setDaily] = useState<Awaited<ReturnType<typeof gameApi.daily>> | null>(null);

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
    void gameApi
      .daily()
      .then(setDaily)
      .catch(() => undefined);
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

  const startLevel = useCallback(async (levelId: string, mode?: 'DAILY') => {
    setStarting(levelId);
    setError(null);
    try {
      const start = await gameApi.startSession(levelId, mode);
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

      {daily?.level && (
        <section className="card daily-card" aria-label={t('daily.title')}>
          <div className="card-head">
            <strong>{t('daily.title')}</strong>
            <span className="tag">{daily.day}</span>
          </div>
          <p className="muted">{t('daily.subtitle')}</p>
          <div className="card-foot">
            <span className="muted">
              {daily.level.world}-{daily.level.index} · {daily.level.name} ·{' '}
              {daily.mine
                ? `${t('daily.myBest')}: ${daily.mine.score.toLocaleString(locale)}`
                : t('daily.notPlayed')}
            </span>
            <button
              type="button"
              className="button button-primary"
              disabled={starting !== null}
              onClick={() => void startLevel(daily.level!.id, 'DAILY')}
            >
              {t('daily.play')}
            </button>
          </div>
          {daily.board.length > 0 && (
            <table className="hub-table">
              <thead>
                <tr>
                  <th>{t('daily.rank')}</th>
                  <th>{t('daily.player')}</th>
                  <th>{t('daily.score')}</th>
                </tr>
              </thead>
              <tbody>
                {daily.board.slice(0, 5).map((row, index) => (
                  <tr key={row.user.id}>
                    <td>{index + 1}</td>
                    <td>
                      {row.user.displayName}
                      <span className="muted"> @{row.user.username}</span>
                    </td>
                    <td>{row.score.toLocaleString(locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

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
                className={`level-card level-${level.type.toLowerCase()} ${
                  level.unlocked === false ? 'level-locked' : ''
                } ${level.completed ? 'level-cleared' : ''}`}
                onClick={() => void startLevel(level.id)}
                disabled={starting !== null || level.unlocked === false}
                aria-disabled={level.unlocked === false}
                title={level.unlocked === false ? t('play.level.lockedHint') : undefined}
              >
                <span className="level-number">{level.index}</span>
                {level.unlocked === false ? (
                  <span className="level-lock" aria-hidden>
                    🔒
                  </span>
                ) : (
                  level.completed && (
                    <span className="level-check" aria-hidden>
                      ✓
                    </span>
                  )
                )}
                {badgeKey && <span className="level-badge">{t(badgeKey)}</span>}
                <span className="level-name">{level.name}</span>
                <span className="level-meta">
                  {level.unlocked === false
                    ? t('play.level.lockedHint')
                    : t('play.level.minutes', {
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
