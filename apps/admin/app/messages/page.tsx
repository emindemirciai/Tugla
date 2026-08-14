'use client';

import { useMemo, useState } from 'react';
import { AdminShell } from '../../components/AdminShell';
import { formatDate, StatusNote, useAdminData } from '../../components/primitives';
import { t } from '../../lib/i18n';

interface AuditRow {
  id: string;
  action: string;
  targetId: string | null;
  createdAt: string;
  actor: { id: string; username: string; displayName: string } | null;
  after: Record<string, unknown> | null;
}

interface UserRow {
  id: string;
  username: string;
  displayName: string;
}

/**
 * Message log.
 *
 * Deliberately a log, not a mailbox: it records that one player wrote to
 * another, and that staff contacted a player, without ever showing what was
 * written. Moderation needs to answer "who is contacting whom" — reading
 * private messages is a different power and this screen does not grant it.
 */
export default function MessagesPage() {
  const { data, loading, error } = useAdminData<{ items: AuditRow[] }>(
    '/admin/system/audit?limit=200',
  );
  const { data: users } = useAdminData<{ items: UserRow[] }>('/admin/operations/users?limit=200');
  const [filter, setFilter] = useState<'ALL' | 'PLAYER' | 'STAFF'>('ALL');

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users?.items ?? []) map.set(user.id, `@${user.username}`);
    return map;
  }, [users?.items]);

  const rows = useMemo(
    () =>
      (data?.items ?? []).filter((row) => {
        if (row.action === 'DIRECT_MESSAGE_SENT') return filter !== 'STAFF';
        if (row.action === 'ADMIN_MESSAGE_SENT') return filter !== 'PLAYER';
        return false;
      }),
    [data?.items, filter],
  );

  const describe = (row: AuditRow) => {
    const from = row.actor ? `@${row.actor.username}` : t('messages.system');
    const to = row.targetId ? (names.get(row.targetId) ?? row.targetId.slice(0, 8)) : '—';
    return row.action === 'ADMIN_MESSAGE_SENT'
      ? t('messages.staffLine', { from, to })
      : t('messages.playerLine', { from, to });
  };

  return (
    <AdminShell title={t('messages.title')}>
      <p className="admin-note">{t('messages.privacy')}</p>
      <StatusNote loading={loading} error={error} />

      <div className="admin-toolbar">
        <div className="segmented">
          {(['ALL', 'PLAYER', 'STAFF'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? 'active' : ''}
              onClick={() => setFilter(value)}
            >
              {t(
                value === 'ALL'
                  ? 'messages.filterAll'
                  : value === 'PLAYER'
                    ? 'messages.filterPlayer'
                    : 'messages.filterStaff',
              )}
            </button>
          ))}
        </div>
        <span className="admin-sub">{t('messages.count', { count: rows.length })}</span>
      </div>

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('messages.when')}</th>
              <th>{t('messages.event')}</th>
              <th>{t('messages.kind')}</th>
              <th>{t('messages.size')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{formatDate(row.createdAt)}</td>
                <td>{describe(row)}</td>
                <td>
                  <span
                    className={`tag ${row.action === 'ADMIN_MESSAGE_SENT' ? 'tag-review' : 'tag-active'}`}
                  >
                    {t(row.action === 'ADMIN_MESSAGE_SENT' ? 'messages.staff' : 'messages.player')}
                  </span>
                </td>
                <td>
                  {typeof row.after?.length === 'number'
                    ? t('messages.characters', { count: row.after.length })
                    : '—'}
                </td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={4} className="admin-note">
                  {t('messages.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
