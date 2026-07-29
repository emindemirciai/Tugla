'use client';

import { AdminShell } from '../../components/AdminShell';
import { CatalogEditor } from '../../components/CatalogEditor';
import { t } from '../../lib/i18n';

interface Task {
  id: string;
  key: string;
  name: string;
  cadence: string;
  target: number;
  eventType: string;
  rewards: Record<string, number>;
  active: boolean;
}

export default function TasksPage() {
  return (
    <AdminShell title={t('tasks.title')}>
      <CatalogEditor<Task>
        listPath="/admin/content/tasks"
        upsertPath="/admin/content/tasks"
        description={t('tasks.desc')}
        headers={[
          'Key',
          t('tasks.name'),
          t('tasks.cadence'),
          t('tasks.target'),
          t('tasks.event'),
          t('tasks.reward'),
          t('common.status'),
          '',
        ]}
        toRow={(task, actions) => [
          <code key="k">{task.key}</code>,
          task.name,
          task.cadence,
          task.target,
          <code key="e">{task.eventType}</code>,
          JSON.stringify(task.rewards),
          task.active ? t('common.active') : t('common.inactive'),
          actions(task),
        ]}
        deletePath={(task) => `/admin/content/tasks/${task.id}`}
        template={{
          key: 'daily-blocks-120',
          name: 'Break 120 blocks',
          description: 'Destroy 120 blocks in total today.',
          cadence: 'DAILY',
          target: 120,
          eventType: 'BLOCK_DESTROYED',
          rewards: { credits: 150 },
          active: true,
        }}
      />
    </AdminShell>
  );
}
