'use client';

import { AdminShell } from '../../components/AdminShell';
import { CatalogEditor } from '../../components/CatalogEditor';
import { t } from '../../lib/i18n';

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
    <AdminShell title={t('eco.title')}>
      <CatalogEditor<CatalogItem>
        listPath="/admin/content/catalog"
        upsertPath="/admin/content/catalog"
        description={t('eco.desc')}
        headers={[
          'SKU',
          t('tasks.name'),
          t('ach.category'),
          t('eco.rarity'),
          t('eco.price'),
          t('common.status'),
          '',
        ]}
        toRow={(item, actions) => [
          <code key="s">{item.sku}</code>,
          item.name,
          item.category,
          item.rarity,
          item.currency ? `${item.price} ${item.currency}` : t('eco.realMoneyOff'),
          item.active ? t('common.active') : t('common.inactive'),
          actions(item),
        ]}
        deletePath={(item) => `/admin/content/catalog/${item.id}`}
        template={{
          sku: 'trail-aurora',
          name: 'Aurora trail',
          description: 'Turns the ball trail into aurora colours.',
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
