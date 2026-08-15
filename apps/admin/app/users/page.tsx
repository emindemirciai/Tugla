'use client';

import { useState } from 'react';
import { AdminShell } from '../../components/AdminShell';
import {
  DataTable,
  formatDate,
  StatusNote,
  useAdminAction,
  useAdminData,
} from '../../components/primitives';
import { useAdminSession } from '../../lib/session';
import { t } from '../../lib/i18n';

interface UserRow {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
  status: string;
  riskScore: number;
  bannedUntil: string | null;
  createdAt: string;
}

const ROLES = ['PLAYER', 'SUPPORT', 'ANALYST', 'CONTENT_EDITOR', 'GAME_ADMIN', 'SUPER_ADMIN'];

export default function UsersPage() {
  const { user: staff } = useAdminSession();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { data, loading, error, reload } = useAdminData<{ items: UserRow[]; total: number }>(
    `/admin/operations/users?limit=50${query ? `&search=${encodeURIComponent(query)}` : ''}`,
  );
  const { run, busy, message } = useAdminAction(reload);
  const canModerate = ['GAME_ADMIN', 'SUPER_ADMIN'].includes(staff?.role ?? '');

  return (
    <AdminShell title={t('users.title')}>
      <form
        className="admin-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(search.trim());
        }}
      >
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('users.searchPlaceholder')}
        />
        <button type="submit">{t('common.search')}</button>
        {message && <span className="admin-note">{message}</span>}
      </form>
      <StatusNote loading={loading} error={error} />
      <DataTable
        headers={[
          t('users.user'),
          t('users.role'),
          t('common.status'),
          t('users.risk'),
          t('users.joined'),
          t('common.actions'),
        ]}
        rows={(data?.items ?? []).map((row) => [
          <div key="who">
            <strong>{row.displayName}</strong>
            <div className="admin-sub">
              @{row.username} · {row.email}
            </div>
          </div>,
          canModerate && staff?.role === 'SUPER_ADMIN' ? (
            <select
              key="role"
              defaultValue={row.role}
              onChange={(event) =>
                void run(
                  `/admin/operations/users/${row.id}/role`,
                  { method: 'PATCH', body: { role: event.target.value } },
                  t('users.roleUpdated'),
                )
              }
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          ) : (
            row.role
          ),
          <span key="status" className={`tag tag-${row.status.toLowerCase()}`}>
            {row.status}
            {row.bannedUntil ? ` → ${formatDate(row.bannedUntil)}` : ''}
          </span>,
          row.riskScore,
          formatDate(row.createdAt),
          <div key="actions" className="admin-actions">
            {row.status !== 'DELETED' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const displayName = window.prompt(t('users.editNamePrompt'), row.displayName);
                  if (displayName === null) return;
                  const username = window.prompt(t('users.editUsernamePrompt'), row.username);
                  if (username === null) return;
                  void run(
                    `/admin/operations/users/${row.id}/profile`,
                    {
                      method: 'PATCH',
                      body: {
                        displayName: displayName.trim(),
                        username: username.trim().toLowerCase(),
                      },
                    },
                    t('users.profileSaved'),
                  );
                }}
              >
                {t('users.editProfile')}
              </button>
            )}
            {row.status !== 'DELETED' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const title = window.prompt(t('users.messageTitlePrompt'));
                  if (!title?.trim()) return;
                  const body = window.prompt(t('users.messageBodyPrompt'));
                  if (!body?.trim()) return;
                  void run(
                    `/admin/operations/users/${row.id}/message`,
                    { method: 'POST', body: { title: title.trim(), body: body.trim() } },
                    t('users.messageSent'),
                  );
                }}
              >
                {t('users.message')}
              </button>
            )}
            {canModerate && row.status !== 'SUSPENDED' && row.status !== 'DELETED' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt(t('users.banReasonPrompt'));
                  if (!reason) return;
                  const daysRaw = window.prompt(t('users.banDaysPrompt')) ?? '';
                  const days = daysRaw.trim() === '' ? null : Number(daysRaw);
                  void run(
                    `/admin/operations/users/${row.id}/ban`,
                    { method: 'POST', body: { reason, days: Number.isFinite(days) ? days : null } },
                    t('users.banned'),
                  );
                }}
              >
                {t('users.ban')}
              </button>
            )}
            {canModerate && row.status === 'SUSPENDED' && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    `/admin/operations/users/${row.id}/unban`,
                    { method: 'POST' },
                    t('users.unbanned'),
                  )
                }
              >
                {t('users.unban')}
              </button>
            )}
            {canModerate && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const amountRaw = window.prompt(t('users.grantAmountPrompt'));
                  if (!amountRaw) return;
                  const amount = Number(amountRaw);
                  if (!Number.isFinite(amount) || amount === 0) return;
                  const reason = window.prompt(t('users.grantReasonPrompt')) ?? 'manual-adjustment';
                  void run(
                    `/admin/operations/users/${row.id}/grant`,
                    { method: 'POST', body: { currency: 'CREDITS', amount, reason } },
                    t('users.granted'),
                  );
                }}
              >
                {t('users.grant')}
              </button>
            )}
          </div>,
        ])}
      />
      {data && <p className="admin-note">{t('users.total', { count: data.total })}</p>}
    </AdminShell>
  );
}
