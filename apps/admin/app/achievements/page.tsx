'use client';

import { AdminShell } from '../../components/AdminShell';
import { CatalogEditor } from '../../components/CatalogEditor';
import type { Field } from '../../components/RecordForm';
import { t } from '../../lib/i18n';

interface Achievement {
  id: string;
  key: string;
  name: string;
  category: string;
  target: number;
  eventType: string;
  hidden: boolean;
  active: boolean;
}

const ACHIEVEMENT_FIELDS: Field[] = [
  { name: 'key', label: 'Key', type: 'text', required: true, hint: t('catalog.keyHint') },
  { name: 'name', label: t('tasks.name'), type: 'text', required: true },
  { name: 'description', label: t('catalog.description'), type: 'textarea' },
  { name: 'category', label: t('ach.category'), type: 'text' },
  { name: 'target', label: t('tasks.target'), type: 'number' },
  {
    name: 'eventType',
    label: t('tasks.event'),
    type: 'select',
    options: [
      'LEVEL_COMPLETED',
      'BLOCK_DESTROYED',
      'SCORE_EARNED',
      'MAX_BALLS',
      'BOSS_DEFEATED',
    ].map((value) => ({ value, label: value })),
  },
  {
    name: 'rewards',
    label: t('tasks.reward'),
    type: 'rewards',
    currencies: ['credits', 'crystals'],
  },
  { name: 'hidden', label: t('catalog.hidden'), type: 'checkbox' },
  { name: 'active', label: t('common.active'), type: 'checkbox' },
];

export default function AchievementsPage() {
  return (
    <AdminShell title={t('ach.title')}>
      <CatalogEditor<Achievement>
        listPath="/admin/content/achievements"
        upsertPath="/admin/content/achievements"
        headers={[
          'Key',
          t('tasks.name'),
          t('ach.category'),
          t('tasks.target'),
          t('tasks.event'),
          t('ach.hidden'),
          t('common.status'),
          '',
        ]}
        toRow={(item, actions) => [
          <code key="k">{item.key}</code>,
          item.name,
          item.category,
          item.target,
          <code key="e">{item.eventType}</code>,
          item.hidden ? t('common.yes') : t('common.no'),
          item.active ? t('common.active') : t('common.inactive'),
          actions(item),
        ]}
        deletePath={(item) => `/admin/content/achievements/${item.id}`}
        fields={ACHIEVEMENT_FIELDS}
        toDraft={(item) => ({
          key: item.key,
          name: item.name,
          description: '',
          category: item.category,
          target: item.target,
          eventType: item.eventType,
          rewards: {},
          hidden: item.hidden,
          active: item.active,
        })}
        template={{
          key: 'storm-500',
          name: 'Storm',
          description: 'Reach 500 simultaneous balls.',
          category: 'mastery',
          target: 500,
          eventType: 'MAX_BALLS',
          rewards: { crystals: 50 },
          hidden: false,
          active: true,
        }}
      />
    </AdminShell>
  );
}
