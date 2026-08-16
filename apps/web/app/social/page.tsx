'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { HubStatus, PlayerShell } from '../../components/PlayerNav';
import { socialApi } from '../../lib/api';
import { useRequirePlayer } from '../../lib/guard';
import { Avatar } from '../../components/Avatar';
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
  // Message composer state: only one friend at a time, so a stray click cannot
  // send a half-written note to the wrong person.
  const [messageTo, setMessageTo] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const [messageNote, setMessageNote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const send = async (userId: string) => {
    setSending(true);
    setMessageNote(null);
    try {
      await socialApi.sendMessage(userId, messageBody.trim());
      setMessageTo(null);
      setMessageBody('');
      setMessageNote(t('social.message.sent'));
    } catch (sendError) {
      setMessageNote(sendError instanceof Error ? sendError.message : t('common.unexpectedError'));
    } finally {
      setSending(false);
    }
  };

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
      {messageNote && (
        <p className="banner" role="status">
          {messageNote}
        </p>
      )}
      <HubStatus loading={loading} error={error} />
      {!loading && friends.length === 0 ? (
        <p className="loading-note">{t('social.noFriends')}</p>
      ) : (
        <ul className="card-list">
          {friends.map((friendship) => {
            const other =
              friendship.requesterId === user?.id ? friendship.addressee : friendship.requester;
            const composing = messageTo === other.id;
            return (
              <li key={friendship.id} className="card">
                <div className="card-foot">
                  <Link className="identity-row" href={`/players/${other.username}`}>
                    <Avatar user={other} />
                    <span>
                      <strong>{other.displayName}</strong>
                      <span className="muted"> @{other.username}</span>
                    </span>
                  </Link>
                  <div className="card-actions">
                    <span className="tag tag-ok">{friendship.status}</span>
                    <button
                      type="button"
                      className="button-quiet"
                      onClick={() => {
                        setMessageTo(composing ? null : other.id);
                        setMessageBody('');
                        setMessageNote(null);
                      }}
                    >
                      {composing ? t('social.message.cancel') : t('social.message.open')}
                    </button>
                  </div>
                </div>

                {composing && (
                  <form
                    className="message-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void send(other.id);
                    }}
                  >
                    <label className="auth-field">
                      <span>{t('social.message.label', { name: other.displayName })}</span>
                      <textarea
                        value={messageBody}
                        onChange={(event) => setMessageBody(event.target.value.slice(0, 1000))}
                        rows={3}
                        maxLength={1000}
                        required
                      />
                      <small>{t('social.message.hint')}</small>
                    </label>
                    <div className="card-actions">
                      <button
                        type="submit"
                        className="button button-primary"
                        disabled={sending || messageBody.trim().length === 0}
                      >
                        {sending ? t('common.processing') : t('social.message.send')}
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PlayerShell>
  );
}
