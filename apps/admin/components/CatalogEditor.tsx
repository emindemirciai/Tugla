'use client';

/**
 * Generic key-value catalogue editor used by tasks, achievements, shop items,
 * seasons and announcements: a table of existing rows plus a JSON-backed
 * upsert form. JSON editing keeps the panel honest about exactly what is
 * stored while still validating everything server-side with Zod.
 */
import { useState } from 'react';
import { DataTable, StatusNote, useAdminAction, useAdminData } from './primitives';
import type { ReactNode } from 'react';

export function CatalogEditor<T extends { id: string }>({
  listPath,
  upsertPath,
  headers,
  toRow,
  template,
  deletePath,
  deleteLabel = 'Devre dışı bırak',
  description,
}: {
  listPath: string;
  upsertPath: string;
  headers: string[];
  toRow: (item: T, actions: (item: T) => ReactNode) => ReactNode[];
  template: Record<string, unknown>;
  deletePath?: (item: T) => string;
  deleteLabel?: string;
  description?: string;
}) {
  const { data, loading, error, reload } = useAdminData<{ items: T[] }>(listPath);
  const { run, busy, message } = useAdminAction(reload);
  const [draft, setDraft] = useState(() => JSON.stringify(template, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);

  const submit = () => {
    setParseError(null);
    let body: unknown;
    try {
      body = JSON.parse(draft);
    } catch {
      setParseError('JSON çözümlenemedi; sözdizimini kontrol et.');
      return;
    }
    void run(upsertPath, { method: 'POST', body }, 'Kaydedildi.');
  };

  const actions = (item: T) =>
    deletePath ? (
      <button
        type="button"
        disabled={busy}
        onClick={() => void run(deletePath(item), { method: 'DELETE' }, 'Güncellendi.')}
      >
        {deleteLabel}
      </button>
    ) : null;

  return (
    <>
      {description && <p className="admin-note">{description}</p>}
      {message && <p className="admin-note">{message}</p>}
      <StatusNote loading={loading} error={error} />
      <DataTable headers={headers} rows={(data?.items ?? []).map((item) => toRow(item, actions))} />

      <h2 className="admin-section-title">Ekle / güncelle</h2>
      <p className="admin-note">
        Aynı <code>key</code>/<code>sku</code> mevcutsa kayıt güncellenir. Şema sunucu tarafında
        doğrulanır.
      </p>
      <textarea
        className="admin-json"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={Math.min(20, draft.split('\n').length + 2)}
        spellCheck={false}
      />
      {parseError && <p className="admin-error">{parseError}</p>}
      <div className="admin-toolbar">
        <button type="button" disabled={busy} onClick={submit}>
          Kaydet
        </button>
        <button type="button" onClick={() => setDraft(JSON.stringify(template, null, 2))}>
          Şablona dön
        </button>
      </div>
    </>
  );
}
