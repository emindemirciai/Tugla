'use client';

import { AdminShell } from '../../components/AdminShell';
import { CatalogEditor } from '../../components/CatalogEditor';
import type { Field } from '../../components/RecordForm';
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

const SEASON_FIELDS: Field[] = [
  { name: 'number', label: t('catalog.number'), type: 'number' },
  { name: 'key', label: 'Key', type: 'text', required: true, hint: t('catalog.keyHint') },
  { name: 'name', label: t('seasons.name'), type: 'text', required: true },
  { name: 'theme', label: t('seasons.theme'), type: 'text' },
  { name: 'startsAt', label: t('seasons.start'), type: 'datetime' },
  { name: 'endsAt', label: t('seasons.end'), type: 'datetime' },
  { name: 'active', label: t('common.active'), type: 'checkbox' },
  {
    name: 'rewards',
    label: t('catalog.rewardsJson'),
    type: 'json',
    wide: true,
    hint: t('catalog.rewardsJsonHint'),
  },
];

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
        fields={SEASON_FIELDS}
        toDraft={(item) => ({
          number: item.number,
          key: item.key,
          name: item.name,
          theme: item.theme,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          active: item.active,
          rewards: {},
        })}
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
