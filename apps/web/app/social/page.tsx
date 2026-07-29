'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { HubStatus, PlayerShell } from '../../components/PlayerNav';
import { socialApi } from '../../lib/api';
import { useRequirePlayer } from '../../lib/guard';
import { useI18n } from '../../lib/i18n';

interface FriendRow {
  id: string;
  status: string;
  requesterId: string;
  addresseeId: string;
  requester: { id: string; username: string; displayName: string };
  addressee: { id: string; username: string; displayName: string };
}

export default function SocialPage() {
  const { t } = useI18n();
  const { ready, user } = useRequirePlayer();
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [results, setResults] = useState<{ id: string; username: string; displayName: string }[]>(
    [],
  );
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadFriends = useCallback(async () => {
    setLoading(true);
    try {
      const result = await socialApi.friends();
      setFriends(result.items as unknown as FriendRow[]);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('common.unexpectedError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (ready) void loadFriends();
  }, [ready, loadFriends]);

  if (!ready) return null;

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setNotice(null);
    try {
      const result = await socialApi.search(query.trim());
      setResults(result.items.filter((entry) => entry.id !== user?.id));
      setSearched(true);
    } catch {
      setNotice(t('social.actionFailed'));
    }
  };

  const act = async (action: () => Promise<unknown>, message: string) => {
    setNotice(null);
    try {
      await action();
      setNotice(message);
      await loadFriends();
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : t('social.actionFailed'));
    }
  };

  return (
    <PlayerShell title={t('social.title')}>
      <form className="hub-toolbar" onSubmit={search}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('social.searchPlaceholder')}
          aria-label={t('social.searchPlaceholder')}
        />
        <button type="submit" className="button">
          {t('social.search')}
        </button>
      </form>

      {notice && <div className="banner">{notice}</div>}

      {searched &&
        (results.length === 0 ? (
          <p className="loading-note">{t('social.noResults')}</p>
        ) : (
          <ul className="card-list">
            {results.map((entry) => (
              <li key={entry.id} className="card card-row">
                <div>
                  <strong>{entry.displayName}</strong>
                  <span className="muted"> @{entry.username}</span>
                </div>
                <div className="card-actions">
                  <button
                    type="button"
                    className="button-quiet"
                    onClick={() => void act(() => socialApi.follow(entry.id), t('social.followed'))}
                  >
                    {t('social.follow')}
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={() =>
                      void act(() => socialApi.requestFriend(entry.id), t('social.requestSent'))
                    }
                  >
                    {t('social.addFriend')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ))}

      <h2 className="hub-section">{t('social.friends')}</h2>
      <HubStatus loading={loading} error={error} />
      {!loading && friends.length === 0 ? (
        <p className="loading-note">{t('social.noFriends')}</p>
      ) : (
        <ul className="card-list">
          {friends.map((friendship) => {
            const other =
              friendship.requesterId === user?.id ? friendship.addressee : friendship.requester;
            return (
              <li key={friendship.id} className="card card-row">
                <div>
                  <strong>{other.displayName}</strong>
                  <span className="muted"> @{other.username}</span>
                </div>
                <span className="tag tag-ok">{friendship.status}</span>
              </li>
            );
          })}
        </ul>
      )}
    </PlayerShell>
  );
}
