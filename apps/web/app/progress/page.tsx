'use client';

import { useCallback, useEffect, useState } from 'react';
import { HubStatus, PlayerShell } from '../../components/PlayerNav';
import { progressionApi } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { useRequirePlayer } from '../../lib/guard';

type Tab = 'tasks' | 'achievements' | 'wallet';

type Task = Awaited<ReturnType<typeof progressionApi.tasks>>['items'][number];
type Achievement = Awaited<ReturnType<typeof progressionApi.achievements>>['items'][number];
type Wallet = Awaited<ReturnType<typeof progressionApi.wallet>>;

/** Tasks, achievements and the wallet ledger — all claimable from here. */
export default function ProgressPage() {
  const { t, locale } = useI18n();
  const { ready } = useRequirePlayer();
  const { refresh } = useSession();
  const [tab, setTab] = useState<Tab>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [taskResult, achievementResult, walletResult] = await Promise.all([
        progressionApi.tasks(),
        progressionApi.achievements(),
        progressionApi.wallet(),
      ]);
      setTasks(taskResult.items);
      setAchievements(achievementResult.items);
      setWallet(walletResult);
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

  const claim = async (action: () => Promise<unknown>) => {
    setNotice(null);
    try {
      await action();
      setNotice(t('progress.claimSuccess'));
      await Promise.all([load(), refresh()]);
    } catch {
      setNotice(t('progress.claimFailed'));
    }
  };

  const rewardText = (rewards: Record<string, number>) =>
    Object.entries(rewards)
      .map(([currency, amount]) => `+${amount} ${currency}`)
      .join(' · ');

  return (
    <PlayerShell title={t('progress.title')}>
      <div className="segmented" role="tablist">
        {(['tasks', 'achievements', 'wallet'] as Tab[]).map((entry) => (
          <button
            key={entry}
            type="button"
            role="tab"
            aria-selected={tab === entry}
            className={tab === entry ? 'active' : ''}
            onClick={() => setTab(entry)}
          >
            {t(`progress.${entry}` as 'progress.tasks')}
          </button>
        ))}
      </div>

      {notice && <div className="banner">{notice}</div>}
      <HubStatus loading={loading} error={error} />

      {tab === 'tasks' &&
        (tasks.length === 0 && !loading ? (
          <p className="loading-note">{t('progress.noTasks')}</p>
        ) : (
          <ul className="card-list">
            {tasks.map((task) => (
              <li key={task.id} className="card">
                <div className="card-head">
                  <strong>{task.name}</strong>
                  <span className="tag">{task.cadence}</span>
                </div>
                <p className="muted">{task.description}</p>
                <div className="progress-bar" aria-hidden>
                  <i style={{ width: `${Math.min(100, (task.progress / task.target) * 100)}%` }} />
                </div>
                <div className="card-foot">
                  <span className="muted">
                    {task.progress}/{task.target} · {rewardText(task.rewards)}
                  </span>
                  {task.claimed ? (
                    <span className="tag tag-ok">{t('progress.claimed')}</span>
                  ) : (
                    <button
                      type="button"
                      className="button"
                      disabled={!task.completed}
                      onClick={() => void claim(() => progressionApi.claimTask(task.id))}
                    >
                      {t('progress.claim')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ))}

      {tab === 'achievements' &&
        (achievements.length === 0 && !loading ? (
          <p className="loading-note">{t('progress.noAchievements')}</p>
        ) : (
          <ul className="card-list">
            {achievements.map((achievement) => (
              <li key={achievement.id} className="card">
                <div className="card-head">
                  <strong>{achievement.name}</strong>
                  <span className="tag">{achievement.category}</span>
                </div>
                <p className="muted">{achievement.description}</p>
                <div className="progress-bar" aria-hidden>
                  <i
                    style={{
                      width: `${Math.min(100, (achievement.progress / achievement.target) * 100)}%`,
                    }}
                  />
                </div>
                <div className="card-foot">
                  <span className="muted">
                    {achievement.progress}/{achievement.target} ·{' '}
                    {achievement.unlocked ? t('progress.unlocked') : t('progress.inProgress')}
                  </span>
                  {achievement.claimed ? (
                    <span className="tag tag-ok">{t('progress.claimed')}</span>
                  ) : (
                    <button
                      type="button"
                      className="button"
                      disabled={!achievement.unlocked}
                      onClick={() =>
                        void claim(() => progressionApi.claimAchievement(achievement.id))
                      }
                    >
                      {t('progress.claim')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ))}

      {tab === 'wallet' && wallet && (
        <>
          <h2 className="hub-section">{t('progress.balances')}</h2>
          <div className="balance-row">
            {wallet.balances.map((balance) => (
              <div key={balance.currency} className="balance-chip">
                <strong>{balance.amount.toLocaleString(locale)}</strong>
                <span>{balance.currency}</span>
              </div>
            ))}
          </div>
          <h2 className="hub-section">{t('progress.transactions')}</h2>
          {wallet.transactions.length === 0 ? (
            <p className="loading-note">{t('progress.noTransactions')}</p>
          ) : (
            <table className="hub-table">
              <thead>
                <tr>
                  <th>{t('progress.date')}</th>
                  <th>{t('progress.reason')}</th>
                  <th>{t('progress.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {wallet.transactions.map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.createdAt).toLocaleString(locale)}</td>
                    <td>
                      <code>{entry.reason}</code>
                    </td>
                    <td className={entry.amount < 0 ? 'error' : 'accent'}>
                      {entry.amount > 0 ? '+' : ''}
                      {entry.amount} {entry.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </PlayerShell>
  );
}
