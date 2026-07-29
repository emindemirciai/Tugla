'use client';

import { AdminShell } from '../../components/AdminShell';
import { CatalogEditor } from '../../components/CatalogEditor';
import { formatDate, useAdminAction } from '../../components/primitives';
import { t } from '../../lib/i18n';

interface Announcement {
  id: string;
  title: string;
  audience: string;
  publishedAt: string | null;
  expiresAt: string | null;
}

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
