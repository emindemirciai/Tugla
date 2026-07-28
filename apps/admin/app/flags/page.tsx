'use client';

import { AdminShell } from '../../components/AdminShell';
import { CatalogEditor } from '../../components/CatalogEditor';

interface Flag {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  config: unknown;
}

export default function FlagsPage() {
  return (
    <AdminShell title="Feature flags ve remote config">
      <CatalogEditor<Flag>
        listPath="/admin/content/flags"
        upsertPath="/admin/content/flags"
        description="Flag'ler 30 sn Redis önbelleğiyle /config üzerinden tüm istemcilere gider. config alanı serbest JSON'dur ve remote config olarak istemciye aynen iletilir."
        headers={['Key', 'Açıklama', 'Durum', 'Config']}
        toRow={(item) => [
          <code key="k">{item.key}</code>,
          item.description,
          item.enabled ? 'açık' : 'kapalı',
          <code key="c">{JSON.stringify(item.config)}</code>,
        ]}
        template={{
          key: 'community-levels',
          description: 'Topluluk bölümleri sekmesini aç/kapat',
          enabled: false,
          config: { minPlayerLevel: 5 },
        }}
      />
    </AdminShell>
  );
}
