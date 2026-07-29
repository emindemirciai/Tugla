'use client';

import { AdminShell } from '../../components/AdminShell';
import { CatalogEditor } from '../../components/CatalogEditor';
import { t } from '../../lib/i18n';

interface Flag {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  config: unknown;
}

export default function FlagsPage() {
  return (
    <AdminShell title={t('flags.title')}>
      <CatalogEditor<Flag>
        listPath="/admin/content/flags"
        upsertPath="/admin/content/flags"
        description={t('flags.desc')}
        headers={['Key', t('flags.description'), t('common.status'), 'Config']}
        toRow={(item) => [
          <code key="k">{item.key}</code>,
          item.description,
          item.enabled ? t('common.on') : t('common.off'),
          <code key="c">{JSON.stringify(item.config)}</code>,
        ]}
        template={{
          key: 'community-levels',
          description: 'Toggle the community levels tab',
          enabled: false,
          config: { minPlayerLevel: 5 },
        }}
      />
    </AdminShell>
  );
}
