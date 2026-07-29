'use client';

import { useCallback, useEffect, useState } from 'react';
import { HubStatus, PlayerShell } from '../../components/PlayerNav';
import { gameApi } from '../../lib/api';
import { useRequirePlayer } from '../../lib/guard';
import { useI18n } from '../../lib/i18n';

interface ReplayRow {
  id: string;
  sessionId: string;
  shared: boolean;
  createdAt: string;
  session?: {
    score: number;
    status: string;
    level: { name: string; world: number; index: number };
  };
}

export default function ReplaysPage() {
  const { t, locale } = useI18n();
  const { ready } = useRequirePlayer();
  const [items, setItems] = useState<ReplayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await gameApi.replays();
      setItems(result.items as unknown as ReplayRow[]);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('common.unexpectedError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  if (!ready) return null;

  const toggleShare = async (row: ReplayRow) => {
    setBusy(row.id);
    try {
      await gameApi.shareReplay(row.sessionId, !row.shared);
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <PlayerShell title={t('replays.title')}>
      <p className="loading-note">{t('replays.verifiedNote')}</p>
      <HubStatus loading={loading} error={error} />

      {!loading && items.length === 0 ? (
        <p className="loading-note">{t('replays.empty')}</p>
      ) : (
        <table className="hub-table">
          <thead>
            <tr>
              <th>{t('replays.level')}</th>
              <th>{t('replays.score')}</th>
              <th>{t('replays.date')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>
                  {row.session
                    ? `${row.session.level.world}-${row.session.level.index} ${row.session.level.name}`
                    : row.sessionId.slice(0, 8)}
                </td>
                <td>{row.session ? row.session.score.toLocaleString(locale) : '—'}</td>
                <td>{new Date(row.createdAt).toLocaleString(locale)}</td>
                <td>
                  <button
                    type="button"
                    className="button-quiet"
                    disabled={busy === row.id}
                    onClick={() => void toggleShare(row)}
                  >
                    {row.shared ? t('replays.unshare') : t('replays.share')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PlayerShell>
  );
}
