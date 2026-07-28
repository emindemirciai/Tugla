'use client';

import { AdminShell } from '../../components/AdminShell';
import { DataTable, StatusNote, useAdminData } from '../../components/primitives';

interface Analytics {
  days: number;
  signups: { day: string; count: number }[];
  sessions: { day: string; count: number; avg_score: number | null }[];
  economy: { reason: string; total: number }[];
}

export default function AnalyticsPage() {
  const { data, loading, error } = useAdminData<Analytics>('/admin/system/analytics?days=14');

  return (
    <AdminShell title="Analitik (son 14 gün)">
      <StatusNote loading={loading} error={error} />
      {data && (
        <>
          <h2 className="admin-section-title">Günlük kayıt ve oturum</h2>
          <DataTable
            headers={['Gün', 'Yeni kayıt', 'Oturum', 'Ortalama skor']}
            rows={data.sessions.map((session) => {
              const signup = data.signups.find((entry) => entry.day === session.day);
              return [
                new Date(session.day).toLocaleDateString('tr-TR'),
                signup?.count ?? 0,
                session.count,
                session.avg_score ? Math.round(session.avg_score).toLocaleString('tr-TR') : '—',
              ];
            })}
          />
          <h2 className="admin-section-title">Ekonomi akışı (kaynak bazında)</h2>
          <DataTable
            headers={['Kaynak', 'Net hareket']}
            rows={data.economy.map((row) => [
              <code key="r">{row.reason}</code>,
              row.total.toLocaleString('tr-TR'),
            ])}
          />
        </>
      )}
    </AdminShell>
  );
}
