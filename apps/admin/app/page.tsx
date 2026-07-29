'use client';

import { AdminShell } from '../components/AdminShell';
import { StatusNote, useAdminData } from '../components/primitives';
import { t } from '../lib/i18n';

interface Overview {
  users: number;
  newUsersThisWeek: number;
  activeToday: number;
  sessions24h: number;
  publishedLevels: number;
  openReports: number;
  openTickets: number;
  flaggedSessionsThisWeek: number;
}

export default function AdminDashboard() {
  const { data, loading, error } = useAdminData<Overview>('/admin/system/overview');

  const cards = data
    ? [
        { label: t('dash.users'), value: data.users },
        { label: t('dash.newUsers'), value: data.newUsersThisWeek },
        { label: t('dash.activeToday'), value: data.activeToday },
        { label: t('dash.sessions24h'), value: data.sessions24h },
        { label: t('dash.publishedLevels'), value: data.publishedLevels },
        { label: t('dash.openReports'), value: data.openReports },
        { label: t('dash.openTickets'), value: data.openTickets },
        { label: t('dash.flagged'), value: data.flaggedSessionsThisWeek },
      ]
    : [];

  return (
    <AdminShell title={t('nav.overview')}>
      <StatusNote loading={loading} error={error} />
      <div className="stat-grid">
        {cards.map((card) => (
          <div key={card.label} className="stat-card">
            <strong>{card.value.toLocaleString('tr-TR')}</strong>
            <span>{card.label}</span>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
