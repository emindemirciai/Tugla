'use client';

import { useState } from 'react';
import { AdminShell } from '../../components/AdminShell';
import { DataTable, formatDate, StatusNote, useAdminData } from '../../components/primitives';

interface AuditRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  createdAt: string;
  ipAddress: string | null;
  actor: { username: string; email: string } | null;
}

export default function AuditPage() {
  const [filter, setFilter] = useState('');
  const [applied, setApplied] = useState('');
  const { data, loading, error } = useAdminData<{ items: AuditRow[]; total: number }>(
    `/admin/system/audit?limit=100${applied ? `&action=${encodeURIComponent(applied)}` : ''}`,
  );

  return (
    <AdminShell title="Audit log">
      <form
        className="admin-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied(filter.trim());
        }}
      >
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Eylem filtrele (ör. LEVEL, USER_BAN)"
        />
        <button type="submit">Filtrele</button>
      </form>
      <StatusNote loading={loading} error={error} />
      <DataTable
        headers={['Eylem', 'Hedef', 'Yapan', 'IP', 'Zaman']}
        rows={(data?.items ?? []).map((row) => [
          <code key="a">{row.action}</code>,
          `${row.targetType}${row.targetId ? ` · ${row.targetId.slice(0, 8)}` : ''}`,
          row.actor ? `@${row.actor.username}` : 'sistem',
          row.ipAddress ?? '—',
          formatDate(row.createdAt),
        ])}
      />
      {data && <p className="admin-note">Toplam {data.total} kayıt (immutable).</p>}
    </AdminShell>
  );
}
