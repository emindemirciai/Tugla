'use client';

import { AdminShell } from '../../components/AdminShell';
import { DataTable, formatDate, StatusNote, useAdminData } from '../../components/primitives';

interface League {
  id: string;
  key: string;
  tier: string;
  startsAt: string;
  endsAt: string;
  groups: number;
  members: number;
}

export default function LeaguesPage() {
  const { data, loading, error } = useAdminData<{ items: League[] }>('/admin/system/leagues');
  return (
    <AdminShell title="Haftalık ligler">
      <p className="admin-note">
        Ligler ISO hafta anahtarıyla otomatik açılır; oyuncular ilk skoru gönderdiklerinde 30
        kişilik gruplara yerleştirilir. Kapanış her Pazartesi 00:05 UTC'de zamanlanmış görevle
        yapılır: sıralama, terfi/düşme ve ödüller otomatik dağıtılır.
      </p>
      <StatusNote loading={loading} error={error} />
      <DataTable
        headers={['Hafta', 'Kademe', 'Başlangıç', 'Bitiş', 'Grup', 'Oyuncu']}
        rows={(data?.items ?? []).map((row) => [
          <code key="k">{row.key}</code>,
          row.tier,
          formatDate(row.startsAt),
          formatDate(row.endsAt),
          row.groups,
          row.members,
        ])}
      />
    </AdminShell>
  );
}
