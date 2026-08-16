'use client';

import { AdminShell } from '../../components/AdminShell';
import { CatalogEditor } from '../../components/CatalogEditor';
import type { Field } from '../../components/RecordForm';
import { t } from '../../lib/i18n';

interface Flag {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  config: unknown;
}

const FLAG_FIELDS: Field[] = [
  { name: 'key', label: 'Key', type: 'text', required: true, hint: t('catalog.keyHint') },
  { name: 'description', label: t('catalog.description'), type: 'text' },
  { name: 'enabled', label: t('catalog.enabled'), type: 'checkbox' },
  // Remote config is genuinely free-form: clients read whatever is put here, so
  // a fixed set of inputs would be a lie. This is the one field that stays JSON.
  {
    name: 'config',
    label: t('catalog.config'),
    type: 'json',
    wide: true,
    hint: t('catalog.configHint'),
  },
];

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
        fields={FLAG_FIELDS}
        toDraft={(item) => ({
          key: item.key,
          description: item.description ?? '',
          enabled: item.enabled,
          config: item.config ?? {},
        })}
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
