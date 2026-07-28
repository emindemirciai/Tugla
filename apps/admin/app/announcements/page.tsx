'use client';

import { AdminShell } from '../../components/AdminShell';
import { CatalogEditor } from '../../components/CatalogEditor';
import { formatDate, useAdminAction } from '../../components/primitives';

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
    <AdminShell title="Duyurular">
      {publish.message && <p className="admin-note">{publish.message}</p>}
      <CatalogEditor<Announcement>
        listPath="/admin/content/announcements"
        upsertPath="/admin/content/announcements"
        description="publishedAt boş bırakılan duyurular taslak kalır; oyunculara /announcements üzerinden yalnızca yayınlanmış ve süresi geçmemiş olanlar gider."
        headers={['Başlık', 'Hedef', 'Yayın', 'Bitiş', '']}
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
                  'Duyuru yayınlandı. Listeyi yenilemek için sayfayı tazele.',
                )
              }
            >
              Şimdi yayınla
            </button>
          ),
          formatDate(item.expiresAt),
          actions(item),
        ]}
        deletePath={(item) => `/admin/content/announcements/${item.id}`}
        deleteLabel="Sil"
        template={{
          title: 'Yeni sezon başladı',
          body: 'Singularity sezonu açıldı: yeni görevler ve lig ödülleri seni bekliyor.',
          audience: 'ALL',
          publishedAt: null,
          expiresAt: null,
        }}
      />
    </AdminShell>
  );
}
