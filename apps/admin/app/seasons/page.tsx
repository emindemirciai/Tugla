'use client';

import { AdminShell } from '../../components/AdminShell';
import { CatalogEditor } from '../../components/CatalogEditor';
import { formatDate } from '../../components/primitives';
import { t } from '../../lib/i18n';

interface Season {
  id: string;
  number: number;
  key: string;
  name: string;
  theme: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

export default function SeasonsPage() {
  return (
    <AdminShell title={t('seasons.title')}>
      <CatalogEditor<Season>
        listPath="/admin/content/seasons"
        upsertPath="/admin/content/seasons"
        description={t('seasons.desc')}
        headers={[
          '#',
          'Key',
          t('seasons.name'),
          t('seasons.theme'),
          t('seasons.start'),
          t('seasons.end'),
          t('seasons.active'),
        ]}
        toRow={(item) => [
          item.number,
          <code key="k">{item.key}</code>,
          item.name,
          item.theme,
          formatDate(item.startsAt),
          formatDate(item.endsAt),
          item.active ? '✓' : '—',
        ]}
        template={{
          number: 2,
          key: 'season-2',
          name: 'Crystal Surge',
          theme: 'crystal-core',
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 90 * 86400000).toISOString(),
          active: false,
          rewards: { top1: { crystals: 500 }, top10: { crystals: 150 } },
        }}
      />
    </AdminShell>
  );
}
