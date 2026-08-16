'use client';

import { AdminShell } from '../../components/AdminShell';
import { CatalogEditor } from '../../components/CatalogEditor';
import type { Field } from '../../components/RecordForm';
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

const ITEM_FIELDS: Field[] = [
  { name: 'sku', label: 'SKU', type: 'text', required: true, hint: t('catalog.keyHint') },
  { name: 'name', label: t('tasks.name'), type: 'text', required: true },
  { name: 'description', label: t('catalog.description'), type: 'textarea' },
  { name: 'category', label: t('ach.category'), type: 'text' },
  {
    name: 'rarity',
    label: t('eco.rarity'),
    type: 'select',
    options: ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'].map((value) => ({ value, label: value })),
  },
  {
    name: 'currency',
    label: t('catalog.currency'),
    type: 'select',
    options: [
      { value: 'CREDITS', label: 'CREDITS' },
      { value: 'CRYSTALS', label: 'CRYSTALS' },
      { value: '', label: '—' },
    ],
    hint: t('catalog.currencyHint'),
  },
  { name: 'price', label: t('eco.price'), type: 'number' },
  { name: 'active', label: t('common.active'), type: 'checkbox' },
];

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
        fields={ITEM_FIELDS}
        toDraft={(item) => ({
          sku: item.sku,
          name: item.name,
          description: '',
          category: item.category,
          rarity: item.rarity,
          currency: item.currency ?? '',
          price: item.price ?? 0,
          active: item.active,
        })}
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
