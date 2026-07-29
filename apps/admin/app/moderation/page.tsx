'use client';

import { AdminShell } from '../../components/AdminShell';
import {
  DataTable,
  formatDate,
  StatusNote,
  useAdminAction,
  useAdminData,
} from '../../components/primitives';
import { t } from '../../lib/i18n';

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
    <AdminShell title={t('mod.title')}>
      {message && <p className="admin-note">{message}</p>}

      <h2 className="admin-section-title">{t('mod.reports')}</h2>
      <StatusNote loading={reports.loading} error={reports.error} />
      <DataTable
        headers={[
          t('mod.target'),
          t('mod.reason'),
          t('mod.reporter'),
          t('common.status'),
          t('common.date'),
          t('common.actions'),
        ]}
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
                      {
                        method: 'PATCH',
                        body: { status: 'ACTIONED', resolution: 'Handled via panel' },
                      },
                      t('mod.actioned'),
                    )
                  }
                >
                  {t('mod.action')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      `/admin/operations/reports/${row.id}`,
                      { method: 'PATCH', body: { status: 'DISMISSED' } },
                      t('mod.dismissed'),
                    )
                  }
                >
                  {t('mod.dismiss')}
                </button>
              </>
            )}
          </div>,
        ])}
      />

      <h2 className="admin-section-title">{t('mod.flaggedTitle')}</h2>
      <p className="admin-note">{t('mod.flaggedNote')}</p>
      <StatusNote loading={flagged.loading} error={flagged.error} />
      <DataTable
        headers={[
          t('mod.player'),
          t('mod.level'),
          t('mod.reportedScore'),
          t('users.risk'),
          t('common.date'),
        ]}
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
