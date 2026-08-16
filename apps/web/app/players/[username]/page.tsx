'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '../../../components/Avatar';
import { PlayerShell } from '../../../components/PlayerNav';
import { socialApi } from '../../../lib/api';
import { useI18n } from '../../../lib/i18n';

interface Profile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  providerAvatarUrl: string | null;
  joinedAt: string;
  playerLevel: number;
  experience: number;
  campaignLevel: number;
  levelsCleared: number;
  achievementsUnlocked: number;
  bestWeeklyScore: number | null;
  isSelf: boolean;
  friendship: { id: string; status: string; incoming: boolean } | null;
}

/**
 * Public player profile.
 *
 * Search could find people and friendship could connect them, but nothing let
 * you see who they were before deciding. This is that page: progress and
 * standing, and exactly the action that applies — add, accept, message, or
 * nothing at all when you are looking at yourself.
 */
export default function PlayerProfilePage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useParams<{ username: string }>();
  const username = String(params?.username ?? '');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    socialApi
      .profile(username)
      .then((result) => setProfile(result as unknown as Profile))
      .catch(() => setError(t('profile.notFound')));
  }, [username, t]);

  useEffect(load, [load]);

  const addFriend = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      await socialApi.requestFriend(profile.id);
      setNotice(t('profile.requestSent'));
      load();
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : t('common.unexpectedError'));
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <PlayerShell title={t('profile.title')}>
        <p className="loading-note">{error}</p>
        <Link className="button" href="/social">
          {t('profile.backToSocial')}
        </Link>
      </PlayerShell>
    );
  }

  if (!profile) {
    return (
      <PlayerShell title={t('profile.title')}>
        <p className="loading-note">{t('common.processing')}</p>
      </PlayerShell>
    );
  }

  const stats = [
    { label: t('profile.playerLevel'), value: profile.playerLevel.toLocaleString(locale) },
    { label: t('profile.levelsCleared'), value: profile.levelsCleared.toLocaleString(locale) },
    {
      label: t('profile.achievements'),
      value: profile.achievementsUnlocked.toLocaleString(locale),
    },
    {
      label: t('profile.bestWeekly'),
      value:
        profile.bestWeeklyScore === null ? '—' : profile.bestWeeklyScore.toLocaleString(locale),
    },
  ];

  return (
    <PlayerShell title={profile.displayName}>
      <section className="card profile-header">
        <Avatar user={profile} size={72} />
        <div>
          <strong className="profile-name">{profile.displayName}</strong>
          <p className="muted">@{profile.username}</p>
          <p className="muted">
            {t('profile.joined', { date: new Date(profile.joinedAt).toLocaleDateString(locale) })}
          </p>
        </div>

        <div className="card-actions">
          {profile.isSelf ? (
            <Link className="button" href="/account">
              {t('profile.editOwn')}
            </Link>
          ) : profile.friendship?.status === 'ACCEPTED' ? (
            <Link className="button button-primary" href="/social">
              {t('profile.message')}
            </Link>
          ) : profile.friendship?.status === 'PENDING' ? (
            <span className="tag tag-review">
              {profile.friendship.incoming ? t('profile.incoming') : t('profile.pending')}
            </span>
          ) : (
            <button
              type="button"
              className="button button-primary"
              disabled={busy}
              onClick={() => void addFriend()}
            >
              {t('profile.addFriend')}
            </button>
          )}
        </div>
      </section>

      {notice && (
        <p className="banner" role="status">
          {notice}
        </p>
      )}

      <div className="balance-row">
        {stats.map((stat) => (
          <div key={stat.label} className="balance-chip">
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>

      <button type="button" className="button-quiet" onClick={() => router.back()}>
        {t('common.back')}
      </button>
    </PlayerShell>
  );
}
