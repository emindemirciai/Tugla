'use client';

import { AdminShell } from '../../components/AdminShell';
import { CatalogEditor } from '../../components/CatalogEditor';
import type { Field } from '../../components/RecordForm';
import { formatDate, useAdminAction } from '../../components/primitives';
import { t } from '../../lib/i18n';

interface Announcement {
  id: string;
  title: string;
  audience: string;
  publishedAt: string | null;
  expiresAt: string | null;
}

const ANNOUNCEMENT_FIELDS: Field[] = [
  { name: 'title', label: t('catalog.title'), type: 'text', required: true },
  { name: 'body', label: t('catalog.body'), type: 'textarea' },
  {
    name: 'audience',
    label: t('catalog.audience'),
    type: 'select',
    options: ['ALL', 'PLAYERS', 'STAFF'].map((value) => ({ value, label: value })),
  },
  {
    name: 'publishedAt',
    label: t('catalog.publishedAt'),
    type: 'datetime',
    hint: t('catalog.publishedHint'),
  },
  {
    name: 'expiresAt',
    label: t('catalog.expiresAt'),
    type: 'datetime',
    hint: t('catalog.expiresHint'),
  },
];

export default function AnnouncementsPage() {
  const publish = useAdminAction();
  return (
    <AdminShell title={t('ann.title')}>
      {publish.message && <p className="admin-note">{publish.message}</p>}
      <CatalogEditor<Announcement>
        listPath="/admin/content/announcements"
        upsertPath="/admin/content/announcements"
        description={t('ann.desc')}
        headers={[t('ann.header'), t('ann.audience'), t('ann.published'), t('ann.expires'), '']}
        toRow={(item, actions) => [
          item.title,
          item.audience,
          item.publishedAt ? (
            formatDate(item.publishedAt)
          ) : (
            <button
              key="p"
              type="button"
              onClick={() =>
                void publish.run(
                  `/admin/content/announcements/${item.id}/publish`,
                  { method: 'POST' },
                  t('ann.publishedMsg'),
                )
              }
            >
              {t('ann.publishNow')}
            </button>
          ),
          formatDate(item.expiresAt),
          actions(item),
        ]}
        deletePath={(item) => `/admin/content/announcements/${item.id}`}
        deleteLabel={t('catalog.delete')}
        fields={ANNOUNCEMENT_FIELDS}
        toDraft={(item) => ({
          title: item.title,
          // The list endpoint omits the body; editing starts from an empty one.
          body: '',
          audience: item.audience,
          publishedAt: item.publishedAt,
          expiresAt: item.expiresAt ?? '',
        })}
        template={{
          title: 'New season live',
          body: 'The Singularity season is live: new tasks and league rewards await.',
          audience: 'ALL',
          publishedAt: null,
          expiresAt: null,
        }}
      />
    </AdminShell>
  );
}
