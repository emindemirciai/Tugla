'use client';

import { AdminShell } from '../../components/AdminShell';
import { CatalogEditor } from '../../components/CatalogEditor';
import type { Field } from '../../components/RecordForm';
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

/** Event names the game actually emits; a free-text box invited typos. */
const EVENTS = ['LEVEL_COMPLETED', 'BLOCK_DESTROYED', 'SCORE_EARNED', 'MAX_BALLS', 'BOSS_DEFEATED'];

const TASK_FIELDS: Field[] = [
  { name: 'key', label: 'Key', type: 'text', required: true, hint: t('catalog.keyHint') },
  { name: 'name', label: t('tasks.name'), type: 'text', required: true },
  { name: 'description', label: t('catalog.description'), type: 'textarea' },
  {
    name: 'cadence',
    label: t('tasks.cadence'),
    type: 'select',
    options: ['DAILY', 'WEEKLY', 'SEASONAL', 'PERMANENT'].map((value) => ({ value, label: value })),
  },
  { name: 'target', label: t('tasks.target'), type: 'number' },
  {
    name: 'eventType',
    label: t('tasks.event'),
    type: 'select',
    options: EVENTS.map((value) => ({ value, label: value })),
  },
  {
    name: 'rewards',
    label: t('tasks.reward'),
    type: 'rewards',
    currencies: ['credits', 'crystals'],
  },
  { name: 'active', label: t('common.active'), type: 'checkbox' },
];

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
        fields={TASK_FIELDS}
        toDraft={(task) => ({
          key: task.key,
          name: task.name,
          description: '',
          cadence: task.cadence,
          target: task.target,
          eventType: task.eventType,
          rewards: task.rewards,
          active: task.active,
        })}
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
