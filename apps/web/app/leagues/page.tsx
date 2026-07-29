'use client';

import { useEffect, useState } from 'react';
import { HubStatus, PlayerShell } from '../../components/PlayerNav';
import { progressionApi, socialApi } from '../../lib/api';
import { useRequirePlayer } from '../../lib/guard';
import { useI18n } from '../../lib/i18n';

type League = Awaited<ReturnType<typeof progressionApi.league>>;
type Board = Awaited<ReturnType<typeof socialApi.leaderboard>>['items'];

/** ISO-week key used by the API when it writes global leaderboard entries. */
const weekKey = (date = new Date()) => {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

export default function LeaguesPage() {
  const { t, locale } = useI18n();
  const { ready } = useRequirePlayer();
  const [league, setLeague] = useState<League | null>(null);
  const [board, setBoard] = useState<Board>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        // A player without a league entry this week is a normal state, not an error.
        const [leagueResult, boardResult] = await Promise.all([
          progressionApi.league().catch(() => null),
          socialApi.leaderboard(`global:${weekKey()}`).catch(() => ({ items: [] })),
        ]);
        if (cancelled) return;
        setLeague(leagueResult);
        setBoard(boardResult.items);
      } catch (loadError) {
        if (!cancelled)
          setError(loadError instanceof Error ? loadError.message : t('common.unexpectedError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, t]);

  if (!ready) return null;

  return (
    <PlayerShell title={t('leagues.title')}>
      <HubStatus loading={loading} error={error} />

      {!loading && !league?.league && <p className="loading-note">{t('leagues.none')}</p>}

      {league?.league && (
        <>
          <div className="balance-row">
            <div className="balance-chip">
              <strong>{league.league.tier}</strong>
              <span>{t('leagues.tier')}</span>
            </div>
            <div className="balance-chip">
              <strong>#{league.groupNumber}</strong>
              <span>{t('leagues.group')}</span>
            </div>
            <div className="balance-chip">
              <strong>{new Date(league.league.endsAt).toLocaleDateString(locale)}</strong>
              <span>{t('leagues.endsAt')}</span>
            </div>
          </div>
          <table className="hub-table">
            <thead>
              <tr>
                <th>{t('leagues.rank')}</th>
                <th>{t('leagues.player')}</th>
                <th>{t('leagues.score')}</th>
              </tr>
            </thead>
            <tbody>
              {league.standings.map((row) => (
                <tr key={row.userId} className={row.isSelf ? 'self-row' : ''}>
                  <td>{row.rank}</td>
                  <td>
                    {row.displayName}
                    <span className="muted"> @{row.username}</span>
                    {row.isSelf && <span className="tag tag-ok"> {t('leagues.you')}</span>}
                  </td>
                  <td>{row.score.toLocaleString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2 className="hub-section">{t('leagues.global')}</h2>
      {board.length === 0 ? (
        <p className="loading-note">{t('leagues.emptyBoard')}</p>
      ) : (
        <table className="hub-table">
          <thead>
            <tr>
              <th>{t('leagues.rank')}</th>
              <th>{t('leagues.player')}</th>
              <th>{t('leagues.score')}</th>
            </tr>
          </thead>
          <tbody>
            {board.map((row, index) => (
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
    </PlayerShell>
  );
}
