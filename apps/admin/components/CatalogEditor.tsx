'use client';

/**
 * Catalogue screen: a table of existing records plus a form to add or edit one.
 *
 * The form was a JSON textarea. It was honest about the stored shape and awful
 * to use — a missing brace lost the entry, key names had to be memorised, and
 * nothing said which values an enum accepted. Records are now described by a
 * field list and rendered as real inputs; the server still validates with the
 * same Zod schema, so nothing became more permissive.
 */
import { useState } from 'react';
import { DataTable, StatusNote, useAdminAction, useAdminData } from './primitives';
import { RecordForm, type Field } from './RecordForm';
import type { ReactNode } from 'react';
import { t } from '../lib/i18n';

export function CatalogEditor<T extends { id: string }>({
  listPath,
  upsertPath,
  headers,
  toRow,
  template,
  fields,
  toDraft,
  deletePath,
  deleteLabel,
  description,
}: {
  listPath: string;
  upsertPath: string;
  headers: string[];
  toRow: (item: T, actions: (item: T) => ReactNode) => ReactNode[];
  template: Record<string, unknown>;
  /** Field descriptors; the form is generated from these. */
  fields: Field[];
  /** Turns an existing record into form values, for editing in place. */
  toDraft?: (item: T) => Record<string, unknown>;
  deletePath?: (item: T) => string;
  deleteLabel?: string;
  description?: string;
}) {
  const { data, loading, error, reload } = useAdminData<{ items: T[] }>(listPath);
  const { run, busy, message } = useAdminAction(reload);
  const [draft, setDraft] = useState<Record<string, unknown>>(template);
  const [editing, setEditing] = useState<string | null>(null);

  const actions = (item: T) => (
    <div className="admin-actions">
      {toDraft && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setDraft(toDraft(item));
            setEditing(item.id);
            document.getElementById('catalog-form')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          {t('catalog.edit')}
        </button>
      )}
      {deletePath && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(deletePath(item), { method: 'DELETE' }, t('common.updated'))}
        >
          {deleteLabel ?? t('catalog.disable')}
        </button>
      )}
    </div>
  );

  return (
    <>
      {description && <p className="admin-note">{description}</p>}
      {message && <p className="admin-note">{message}</p>}
      <StatusNote loading={loading} error={error} />
      <DataTable headers={headers} rows={(data?.items ?? []).map((item) => toRow(item, actions))} />

      <h2 className="admin-section-title" id="catalog-form">
        {editing ? t('catalog.editTitle') : t('catalog.upsertTitle')}
      </h2>
      <p className="admin-note">{t('catalog.upsertNote')}</p>

      <RecordForm
        fields={fields}
        initial={draft}
        busy={busy}
        submitLabel={t('common.save')}
        onSubmit={(value) => {
          void run(upsertPath, { method: 'POST', body: value }, t('common.saved'));
          setEditing(null);
        }}
        onReset={() => {
          setDraft(template);
          setEditing(null);
        }}
      />
    </>
  );
}
