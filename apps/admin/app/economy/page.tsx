'use client';

import { AdminShell } from '../../components/AdminShell';
import { CatalogEditor } from '../../components/CatalogEditor';

interface CatalogItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  rarity: string;
  currency: string | null;
  price: number | null;
  active: boolean;
}

export default function EconomyPage() {
  return (
    <AdminShell title="Mağaza ve ekonomi">
      <CatalogEditor<CatalogItem>
        listPath="/admin/content/catalog"
        upsertPath="/admin/content/catalog"
        description="currency + price dolu olan ürünler oyun içi para ile satılır. currency: null olan ürünler gerçek para SKU'sudur ve ödeme sağlayıcısı (PAYMENTS_ENABLED + Stripe anahtarları) yapılandırılana kadar mağazada gizli kalır. Oyuncu bakiyeleri Kullanıcılar ekranından, tüm hareketler ise cüzdan defterinden (WalletTransaction) izlenir."
        headers={['SKU', 'Ad', 'Kategori', 'Nadirlik', 'Fiyat', 'Durum', '']}
        toRow={(item, actions) => [
          <code key="s">{item.sku}</code>,
          item.name,
          item.category,
          item.rarity,
          item.currency ? `${item.price} ${item.currency}` : 'gerçek para (kapalı)',
          item.active ? 'aktif' : 'pasif',
          actions(item),
        ]}
        deletePath={(item) => `/admin/content/catalog/${item.id}`}
        template={{
          sku: 'trail-aurora',
          name: 'Aurora izi',
          description: 'Top izini aurora renklerine çevirir.',
          category: 'trail',
          rarity: 'EPIC',
          currency: 'CRYSTALS',
          price: 120,
          metadata: {},
          active: true,
        }}
      />
    </AdminShell>
  );
}
