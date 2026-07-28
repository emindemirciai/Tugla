'use client';

import { AdminShell } from '../../components/AdminShell';
import {
  DataTable,
  formatDate,
  StatusNote,
  useAdminAction,
  useAdminData,
} from '../../components/primitives';

interface Report {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  reporter: { username: string } | null;
}

interface FlaggedSession {
  id: string;
  score: number;
  riskScore: number;
  status: string;
  createdAt: string;
  user: { id: string; username: string; riskScore: number };
  level: { name: string; world: number; index: number };
}

export default function ModerationPage() {
  const reports = useAdminData<{ items: Report[] }>('/admin/operations/reports');
  const flagged = useAdminData<{ items: FlaggedSession[] }>(
    '/admin/operations/flagged-sessions?limit=50',
  );
  const { run, busy, message } = useAdminAction(reports.reload);

  return (
    <AdminShell title="Moderasyon">
      {message && <p className="admin-note">{message}</p>}

      <h2 className="admin-section-title">Kullanıcı şikayetleri</h2>
      <StatusNote loading={reports.loading} error={reports.error} />
      <DataTable
        headers={['Hedef', 'Sebep', 'Bildiren', 'Durum', 'Tarih', 'İşlem']}
        rows={(reports.data?.items ?? []).map((row) => [
          `${row.targetType} · ${row.targetId.slice(0, 8)}`,
          <div key="reason">
            <strong>{row.reason}</strong>
            {row.details && <div className="admin-sub">{row.details}</div>}
          </div>,
          row.reporter?.username ?? '—',
          row.status,
          formatDate(row.createdAt),
          <div key="actions" className="admin-actions">
            {['OPEN', 'REVIEWING'].includes(row.status) && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      `/admin/operations/reports/${row.id}`,
                      { method: 'PATCH', body: { status: 'ACTIONED', resolution: 'Handled via panel' } },
                      'Şikayet işleme alındı.',
                    )
                  }
                >
                  İşlem yap
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      `/admin/operations/reports/${row.id}`,
                      { method: 'PATCH', body: { status: 'DISMISSED' } },
                      'Şikayet reddedildi.',
                    )
                  }
                >
                  Reddet
                </button>
              </>
            )}
          </div>,
        ])}
      />

      <h2 className="admin-section-title">Anti-cheat: şüpheli oturumlar</h2>
      <p className="admin-note">
        Bu oturumlar sunucu tarafı replay doğrulamasından geçemedi; skorları hiçbir tabloya
        yazılmadı.
      </p>
      <StatusNote loading={flagged.loading} error={flagged.error} />
      <DataTable
        headers={['Oyuncu', 'Bölüm', 'Bildirilen skor', 'Risk', 'Tarih']}
        rows={(flagged.data?.items ?? []).map((row) => [
          `@${row.user.username} (risk ${row.user.riskScore})`,
          `${row.level.world}-${row.level.index} ${row.level.name}`,
          row.score.toLocaleString('tr-TR'),
          <span key="risk" className="tag tag-suspended">
            {row.riskScore}
          </span>,
          formatDate(row.createdAt),
        ])}
      />
    </AdminShell>
  );
}
