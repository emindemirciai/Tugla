'use client';

import { useCallback, useEffect, useState } from 'react';
import { HubStatus, PlayerShell } from '../../components/PlayerNav';
import { platformApi, progressionApi } from '../../lib/api';
import { useRequirePlayer } from '../../lib/guard';
import { useI18n } from '../../lib/i18n';

type Shop = Awaited<ReturnType<typeof platformApi.shop>>;

export default function ShopPage() {
  const { t, locale } = useI18n();
  const { ready } = useRequirePlayer();
  const [shop, setShop] = useState<Shop | null>(null);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [balances, setBalances] = useState<{ currency: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [shopResult, inventoryResult, walletResult] = await Promise.all([
        platformApi.shop(),
        platformApi.inventory(),
        progressionApi.wallet(),
      ]);
      setShop(shopResult);
      setOwned(new Set(inventoryResult.items.map((entry) => entry.item.sku)));
      setBalances(walletResult.balances);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('common.unexpectedError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  if (!ready) return null;

  const buy = async (sku: string) => {
    setBusy(sku);
    setNotice(null);
    try {
      await platformApi.purchase(sku);
      setNotice(t('shop.purchased'));
      await load();
    } catch (purchaseError) {
      setNotice(purchaseError instanceof Error ? purchaseError.message : t('shop.purchaseFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <PlayerShell title={t('shop.title')}>
      <div className="balance-row">
        {balances.map((balance) => (
          <div key={balance.currency} className="balance-chip">
            <strong>{balance.amount.toLocaleString(locale)}</strong>
            <span>{balance.currency}</span>
          </div>
        ))}
      </div>

      {notice && <div className="banner">{notice}</div>}
      <HubStatus loading={loading} error={error} />

      {!shop?.paymentsEnabled && <p className="loading-note">{t('shop.paymentsOff')}</p>}

      {shop && shop.items.length === 0 && !loading ? (
        <p className="loading-note">{t('shop.empty')}</p>
      ) : (
        <ul className="card-list">
          {(shop?.items ?? []).map((item) => {
            const isOwned = owned.has(item.sku);
            const affordable =
              item.currency === null ||
              (balances.find((balance) => balance.currency === item.currency)?.amount ?? 0) >=
                (item.price ?? 0);
            return (
              <li key={item.id} className="card">
                <div className="card-head">
                  <strong>{item.name}</strong>
                  <span className={`tag rarity-${item.rarity.toLowerCase()}`}>{item.rarity}</span>
                </div>
                <p className="muted">{item.description}</p>
                <div className="card-foot">
                  <span className="accent">
                    {item.currency ? `${item.price} ${item.currency}` : '—'}
                  </span>
                  {isOwned ? (
                    <span className="tag tag-ok">{t('shop.owned')}</span>
                  ) : (
                    <button
                      type="button"
                      className="button"
                      disabled={busy === item.sku || !item.currency || !affordable}
                      onClick={() => void buy(item.sku)}
                    >
                      {t('shop.buy')}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PlayerShell>
  );
}
