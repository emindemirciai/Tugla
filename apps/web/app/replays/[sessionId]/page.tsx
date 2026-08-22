'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar } from '../../../components/Avatar';
import { PlayerShell } from '../../../components/PlayerNav';
/** Same reasoning as the hub: three.js arrives with the replay, not the page. */
const ReplayViewer = dynamic(
  () => import('../../../components/ReplayViewer').then((module) => module.ReplayViewer),
  { ssr: false },
);
import { gameApi } from '../../../lib/api';
import { useI18n } from '../../../lib/i18n';
import type { LevelDefinition } from '@tugla/shared';

interface ReplayPayload {
  sessionId: string;
  score: number;
  shared: boolean;
  player: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    providerAvatarUrl?: string | null;
  };
  level: { id: string; name: string; definition: LevelDefinition };
  replay: unknown;
}

/**
 * Watch one replay.
 *
 * Replays could be stored and shared but never watched, which made sharing a
 * link to nothing. The recording is replayed in the browser by the same engine
 * the server verifies with, so the score you see is recomputed rather than
 * asserted.
 */
export default function ReplayPage() {
  const { t, locale } = useI18n();
  const params = useParams<{ sessionId: string }>();
  const sessionId = String(params?.sessionId ?? '');

  const [data, setData] = useState<ReplayPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gameApi
      .replay(sessionId)
      .then((result) => setData(result as unknown as ReplayPayload))
      .catch(() => setError(t('replays.notFound')));
  }, [sessionId, t]);

  if (error) {
    return (
      <PlayerShell title={t('replays.title')}>
        <p className="loading-note">{error}</p>
        <Link className="button" href="/replays">
          {t('replays.back')}
        </Link>
      </PlayerShell>
    );
  }

  if (!data) {
    return (
      <PlayerShell title={t('replays.title')}>
        <p className="loading-note">{t('common.processing')}</p>
      </PlayerShell>
    );
  }

  return (
    <PlayerShell title={data.level.name}>
      <section className="card card-foot">
        <Link className="identity-row" href={`/players/${data.player.username}`}>
          <Avatar user={data.player} size={36} />
          <span>
            <strong>{data.player.displayName}</strong>
            <span className="muted"> @{data.player.username}</span>
          </span>
        </Link>
        <span className="tag tag-ok">{data.score.toLocaleString(locale)}</span>
      </section>

      <ReplayViewer
        level={data.level.definition}
        encoded={data.replay}
        expectedScore={data.score}
      />

      <Link className="button-quiet" href="/replays">
        {t('replays.back')}
      </Link>
    </PlayerShell>
  );
}
