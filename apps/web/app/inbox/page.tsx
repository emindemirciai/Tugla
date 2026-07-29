'use client';

import { useCallback, useEffect, useState } from 'react';
import { HubStatus, PlayerShell } from '../../components/PlayerNav';
import { platformApi } from '../../lib/api';
import { useRequirePlayer } from '../../lib/guard';
import { useI18n } from '../../lib/i18n';

type Notifications = Awaited<ReturnType<typeof platformApi.notifications>>;
type Announcements = Awaited<ReturnType<typeof platformApi.announcements>>['items'];

export default function InboxPage() {
  const { t, locale } = useI18n();
  const { ready } = useRequirePlayer();
  const [notifications, setNotifications] = useState<Notifications | null>(null);
  const [announcements, setAnnouncements] = useState<Announcements>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [notificationResult, announcementResult] = await Promise.all([
        platformApi.notifications(),
        platformApi.announcements(),
      ]);
      setNotifications(notificationResult);
      setAnnouncements(announcementResult.items);
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

  return (
    <PlayerShell title={t('inbox.title')}>
      <HubStatus loading={loading} error={error} />

      <h2 className="hub-section">
        {t('inbox.notifications')}
        {notifications && notifications.unread > 0 && (
          <span className="tag tag-ok"> {t('inbox.unread', { count: notifications.unread })}</span>
        )}
      </h2>
      {notifications && notifications.items.length === 0 ? (
        <p className="loading-note">{t('inbox.empty')}</p>
      ) : (
        <ul className="card-list">
          {(notifications?.items ?? []).map((item) => (
            <li key={item.id} className={`card ${item.readAt ? '' : 'card-unread'}`}>
              <div className="card-head">
                <strong>{item.title}</strong>
                <span className="muted">{new Date(item.createdAt).toLocaleString(locale)}</span>
              </div>
              <p className="muted">{item.body}</p>
              {!item.readAt && (
                <div className="card-foot">
                  <button
                    type="button"
                    className="button-quiet"
                    onClick={() =>
                      void platformApi.readNotification(item.id).then(load, () => undefined)
                    }
                  >
                    {t('inbox.markRead')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <h2 className="hub-section">{t('inbox.announcements')}</h2>
      {announcements.length === 0 ? (
        <p className="loading-note">{t('inbox.noAnnouncements')}</p>
      ) : (
        <ul className="card-list">
          {announcements.map((item) => (
            <li key={item.id} className="card">
              <div className="card-head">
                <strong>{item.title}</strong>
                <span className="muted">
                  {new Date(item.publishedAt).toLocaleDateString(locale)}
                </span>
              </div>
              <p className="muted">{item.body}</p>
            </li>
          ))}
        </ul>
      )}
    </PlayerShell>
  );
}
