'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { adminApi, ApiError } from '../lib/api';
import { t } from '../lib/i18n';

/** Fetch hook with manual reload, standard loading/error handling. */
export function useAdminData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      setData(await adminApi<T>(path));
    } catch (fetchError) {
      setError(fetchError instanceof ApiError ? fetchError.message : t('common.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

export function StatusNote({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) return <p className="admin-note">{t('common.loading')}</p>;
  if (error) return <p className="admin-note admin-error">{error}</p>;
  return null;
}

export function DataTable({
  headers,
  rows,
  empty = t('common.empty'),
}: {
  headers: string[];
  rows: ReactNode[][];
  empty?: string;
}) {
  if (!rows.length) return <p className="admin-note">{empty ?? t('common.empty')}</p>;
  return (
    <div className="table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, rowIndex) => (
            // Row order is stable per fetch; index keys are fine for read views.
            <tr key={rowIndex}>
              {cells.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Mutation helper: runs an admin call, reports the outcome inline. */
export function useAdminAction(onDone?: () => void) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = useCallback(
    async (
      path: string,
      options: Parameters<typeof adminApi>[1],
      successMessage = t('common.saved'),
    ) => {
      setBusy(true);
      setMessage(null);
      try {
        await adminApi(path, options);
        setMessage(successMessage);
        onDone?.();
      } catch (actionError) {
        setMessage(
          actionError instanceof ApiError ? actionError.message : t('common.actionFailed'),
        );
      } finally {
        setBusy(false);
      }
    },
    [onDone],
  );

  return { run, busy, message, setMessage };
}

export const formatDate = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleString('tr-TR') : '—';
