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
    <AdminShell title="Kullanıcı yönetimi">
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
          placeholder="E-posta, kullanıcı adı veya isim ara"
        />
        <button type="submit">Ara</button>
        {message && <span className="admin-note">{message}</span>}
      </form>
      <StatusNote loading={loading} error={error} />
      <DataTable
        headers={['Kullanıcı', 'Rol', 'Durum', 'Risk', 'Kayıt', 'İşlemler']}
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
                  'Rol güncellendi.',
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
            {canModerate && row.status !== 'SUSPENDED' && row.status !== 'DELETED' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt('Ban gerekçesi (kullanıcıya iletilir):');
                  if (!reason) return;
                  const daysRaw = window.prompt('Süre (gün, boş = süresiz):') ?? '';
                  const days = daysRaw.trim() === '' ? null : Number(daysRaw);
                  void run(
                    `/admin/operations/users/${row.id}/ban`,
                    { method: 'POST', body: { reason, days: Number.isFinite(days) ? days : null } },
                    'Kullanıcı askıya alındı.',
                  );
                }}
              >
                Banla
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
                    'Ban kaldırıldı.',
                  )
                }
              >
                Banı kaldır
              </button>
            )}
            {canModerate && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const amountRaw = window.prompt('Kredi miktarı (negatif = düş):');
                  if (!amountRaw) return;
                  const amount = Number(amountRaw);
                  if (!Number.isFinite(amount) || amount === 0) return;
                  const reason = window.prompt('Gerekçe:') ?? 'manual-adjustment';
                  void run(
                    `/admin/operations/users/${row.id}/grant`,
                    { method: 'POST', body: { currency: 'CREDITS', amount, reason } },
                    'Bakiye güncellendi.',
                  );
                }}
              >
                Kredi ver
              </button>
            )}
          </div>,
        ])}
      />
      {data && <p className="admin-note">Toplam {data.total} kullanıcı.</p>}
    </AdminShell>
  );
}
