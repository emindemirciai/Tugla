'use client';

import { AdminShell } from '../../components/AdminShell';
import { DataTable, formatDate, StatusNote, useAdminData } from '../../components/primitives';
import { t } from '../../lib/i18n';

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
    <AdminShell title={t('leagues.title')}>
      <p className="admin-note">{t('leagues.desc')}</p>
      <StatusNote loading={loading} error={error} />
      <DataTable
        headers={[
          t('leagues.week'),
          t('leagues.tier'),
          t('seasons.start'),
          t('seasons.end'),
          t('leagues.groups'),
          t('leagues.players'),
        ]}
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
