'use client';

import { AdminShell } from '../components/AdminShell';
import { StatusNote, useAdminData } from '../components/primitives';

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
        { label: 'Aktif kullanıcı', value: data.users },
        { label: 'Bu hafta yeni kayıt', value: data.newUsersThisWeek },
        { label: 'Bugün oynayan', value: data.activeToday },
        { label: 'Son 24 saat oturum', value: data.sessions24h },
        { label: 'Yayında bölüm', value: data.publishedLevels },
        { label: 'Açık moderasyon', value: data.openReports },
        { label: 'Açık destek talebi', value: data.openTickets },
        { label: 'Bu hafta şüpheli oturum', value: data.flaggedSessionsThisWeek },
      ]
    : [];

  return (
    <AdminShell title="Genel bakış">
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
