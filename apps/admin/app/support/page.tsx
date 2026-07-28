'use client';

import { AdminShell } from '../../components/AdminShell';
import {
  DataTable,
  formatDate,
  StatusNote,
  useAdminAction,
  useAdminData,
} from '../../components/primitives';

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

export default function SupportPage() {
  const { data, loading, error, reload } = useAdminData<{ items: Ticket[] }>(
    '/admin/operations/tickets',
  );
  const { run, busy, message } = useAdminAction(reload);

  return (
    <AdminShell title="Destek talepleri">
      {message && <p className="admin-note">{message}</p>}
      <StatusNote loading={loading} error={error} />
      <DataTable
        headers={['Konu', 'Kategori', 'Gönderen', 'Durum', 'Tarih']}
        rows={(data?.items ?? []).map((row) => [
          <div key="subject">
            <strong>{row.subject}</strong>
            <div className="admin-sub">{row.body.slice(0, 160)}</div>
          </div>,
          row.category,
          <div key="from">
            {row.user ? `@${row.user.username}` : 'misafir e-posta'}
            <div className="admin-sub">{row.email}</div>
          </div>,
          <select
            key="status"
            defaultValue={row.status}
            disabled={busy}
            onChange={(event) =>
              void run(
                `/admin/operations/tickets/${row.id}`,
                { method: 'PATCH', body: { status: event.target.value } },
                'Talep güncellendi.',
              )
            }
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>,
          formatDate(row.createdAt),
        ])}
      />
    </AdminShell>
  );
}
