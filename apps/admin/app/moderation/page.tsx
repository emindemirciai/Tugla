'use client';

import { LevelPreview } from '../../components/LevelPreview';
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
  level: ReportLevel | null;
  user: { id: string; username: string; displayName: string; status: string } | null;
}

interface ReportLevel {
  id: string;
  name: string;
  world: number;
  index: number;
  status: string;
  type: string;
  definition: unknown;
  author: { id: string; username: string } | null;
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
          // What was reported, not just its id: a verdict on unseen content is
          // a guess, and the board is the whole evidence for a level report.
          <div key="target" className="report-target">
            {row.level ? (
              <>
                <strong>{row.level.name}</strong>
                <div className="admin-sub">
                  {row.level.world}-{row.level.index} · {row.level.type} · {row.level.status}
                  {row.level.author ? ` · @${row.level.author.username}` : ''}
                </div>
                <LevelPreview definition={row.level.definition} />
              </>
            ) : row.user ? (
              <>
                <strong>{row.user.displayName}</strong>
                <div className="admin-sub">
                  @{row.user.username} · {row.user.status}
                </div>
              </>
            ) : (
              <span className="admin-sub">
                {row.targetType} · {row.targetId.slice(0, 8)}
              </span>
            )}
          </div>,
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
                        body: {
                          status: 'ACTIONED',
                          resolution:
                            window.prompt(t('mod.resolutionPrompt'))?.trim() ||
                            t('mod.noResolution'),
                        },
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
