'use client';

import { AdminShell } from '../../components/AdminShell';
import { CatalogEditor } from '../../components/CatalogEditor';

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
    <AdminShell title="Başarımlar">
      <CatalogEditor<Achievement>
        listPath="/admin/content/achievements"
        upsertPath="/admin/content/achievements"
        headers={['Key', 'Ad', 'Kategori', 'Hedef', 'Olay', 'Gizli', 'Durum', '']}
        toRow={(item, actions) => [
          <code key="k">{item.key}</code>,
          item.name,
          item.category,
          item.target,
          <code key="e">{item.eventType}</code>,
          item.hidden ? 'evet' : 'hayır',
          item.active ? 'aktif' : 'pasif',
          actions(item),
        ]}
        deletePath={(item) => `/admin/content/achievements/${item.id}`}
        template={{
          key: 'storm-500',
          name: 'Fırtına',
          description: 'Aynı anda 500 topa ulaş.',
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
