'use client';

import { AdminShell } from '../../components/AdminShell';
import { CatalogEditor } from '../../components/CatalogEditor';
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
