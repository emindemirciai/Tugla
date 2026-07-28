'use client';

import { AdminShell } from '../../components/AdminShell';
import { CatalogEditor } from '../../components/CatalogEditor';

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
    <AdminShell title="Görevler">
      <CatalogEditor<Task>
        listPath="/admin/content/tasks"
        upsertPath="/admin/content/tasks"
        description="Günlük/haftalık görevler. eventType, oyun sunucusunun yaydığı olaylardan biridir: LEVEL_COMPLETED, BLOCK_DESTROYED, SCORE_EARNED, MAX_BALLS, BOSS_DEFEATED."
        headers={['Key', 'Ad', 'Periyot', 'Hedef', 'Olay', 'Ödül', 'Durum', '']}
        toRow={(task, actions) => [
          <code key="k">{task.key}</code>,
          task.name,
          task.cadence,
          task.target,
          <code key="e">{task.eventType}</code>,
          JSON.stringify(task.rewards),
          task.active ? 'aktif' : 'pasif',
          actions(task),
        ]}
        deletePath={(task) => `/admin/content/tasks/${task.id}`}
        template={{
          key: 'daily-blocks-120',
          name: '120 blok kır',
          description: 'Bugün toplam 120 blok yok et.',
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
