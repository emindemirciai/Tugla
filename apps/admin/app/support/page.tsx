'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '../../components/AdminShell';
import { formatDate, StatusNote, useAdminAction, useAdminData } from '../../components/primitives';
import { t } from '../../lib/i18n';

interface Ticket {
  id: string;
  email: string;
  category: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
  user: { username: string } | null;
}

const STATUSES = ['OPEN', 'INVESTIGATING', 'WAITING_USER', 'RESOLVED', 'CLOSED'];

/**
 * Support inbox.
 *
 * Tickets are correspondence, not rows: a table forced the body into a 160
 * character stub, so reading one meant guessing. This is the shape people
 * already know from a mail client — the list on the left, the message on the
 * right — which also leaves room for the full body and the reply controls.
 */
export default function SupportPage() {
  const { data, loading, error, reload } = useAdminData<{ items: Ticket[] }>(
    '/admin/operations/tickets',
  );
  const { run, busy, message } = useAdminAction(reload);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'OPEN'>('ALL');

  const tickets = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (data?.items ?? []).filter((ticket) => {
      if (filter === 'OPEN' && (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'))
        return false;
      if (!term) return true;
      return [ticket.subject, ticket.body, ticket.email, ticket.user?.username ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [data?.items, filter, query]);

  // Keep a message open across reloads; fall back to the newest one.
  useEffect(() => {
    if (!tickets.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) =>
      current && tickets.some((ticket) => ticket.id === current) ? current : tickets[0]!.id,
    );
  }, [tickets]);

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;

  return (
    <AdminShell title={t('support.title')}>
      {message && <p className="admin-note">{message}</p>}
      <StatusNote loading={loading} error={error} />

      <div className="mail-toolbar">
        <input
          type="search"
          value={query}
          placeholder={t('support.search')}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="segmented">
          <button
            type="button"
            className={filter === 'ALL' ? 'active' : ''}
            onClick={() => setFilter('ALL')}
          >
            {t('support.filterAll')}
          </button>
          <button
            type="button"
            className={filter === 'OPEN' ? 'active' : ''}
            onClick={() => setFilter('OPEN')}
          >
            {t('support.filterOpen')}
          </button>
        </div>
        <span className="admin-sub">{t('support.count', { count: tickets.length })}</span>
      </div>

      <div className="mail-layout">
        <ul className="mail-list" aria-label={t('support.title')}>
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <button
                type="button"
                className={`mail-item ${ticket.id === selectedId ? 'active' : ''}`}
                onClick={() => setSelectedId(ticket.id)}
                aria-current={ticket.id === selectedId}
              >
                <span className="mail-item-top">
                  <strong>{ticket.user ? `@${ticket.user.username}` : t('support.guest')}</strong>
                  <span className="admin-sub">{formatDate(ticket.createdAt)}</span>
                </span>
                <span className="mail-item-subject">{ticket.subject}</span>
                <span className="admin-sub mail-item-preview">{ticket.body}</span>
                <span className={`tag tag-${ticket.status.toLowerCase()}`}>{ticket.status}</span>
              </button>
            </li>
          ))}
          {!tickets.length && !loading && <li className="admin-note">{t('support.empty')}</li>}
        </ul>

        <section className="mail-reader" aria-live="polite">
          {selected ? (
            <>
              <header className="mail-head">
                <h2>{selected.subject}</h2>
                <div className="mail-meta">
                  <span>
                    <strong>
                      {selected.user ? `@${selected.user.username}` : t('support.guest')}
                    </strong>{' '}
                    &lt;{selected.email}&gt;
                  </span>
                  <span className="admin-sub">{formatDate(selected.createdAt)}</span>
                </div>
                <div className="mail-actions">
                  <span className="admin-sub">{selected.category}</span>
                  <select
                    value={selected.status}
                    disabled={busy}
                    onChange={(event) =>
                      void run(`/admin/operations/tickets/${selected.id}`, {
                        method: 'PATCH',
                        body: { status: event.target.value },
                      })
                    }
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <a
                    className="button-link"
                    href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}
                  >
                    {t('support.reply')}
                  </a>
                </div>
              </header>
              <article className="mail-body">{selected.body}</article>
            </>
          ) : (
            <p className="admin-note">{t('support.selectPrompt')}</p>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
