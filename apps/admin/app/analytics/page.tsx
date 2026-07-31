'use client';

import { AdminShell } from '../../components/AdminShell';
import { DataTable, StatusNote, useAdminData } from '../../components/primitives';
import { t } from '../../lib/i18n';

interface Analytics {
  days: number;
  signups: { day: string; count: number }[];
  sessions: { day: string; count: number; avg_score: number | null }[];
  economy: { reason: string; total: number }[];
}

const analyticsUrl = process.env.NEXT_PUBLIC_ANALYTICS_URL?.trim();

export default function AnalyticsPage() {
  const { data, loading, error } = useAdminData<Analytics>('/admin/system/analytics?days=14');

  return (
    <AdminShell title={t('analytics.title')}>
      <StatusNote loading={loading} error={error} />

      <section className="card-note">
        <h2 className="admin-section-title">{t('analytics.siteTitle')}</h2>
        <p className="admin-note">{t('analytics.siteBody')}</p>
        {analyticsUrl ? (
          <a className="admin-env" href={analyticsUrl} target="_blank" rel="noreferrer noopener">
            {t('analytics.siteOpen')} ↗
          </a>
        ) : (
          <p className="admin-note">{t('analytics.siteOff')}</p>
        )}
      </section>
      {data && (
        <>
          <h2 className="admin-section-title">{t('analytics.daily')}</h2>
          <DataTable
            headers={[
              t('analytics.day'),
              t('analytics.signups'),
              t('analytics.sessions'),
              t('analytics.avgScore'),
            ]}
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
          <h2 className="admin-section-title">{t('analytics.economy')}</h2>
          <DataTable
            headers={[t('analytics.source'), t('analytics.net')]}
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
