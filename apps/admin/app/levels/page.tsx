'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { LevelDefinition } from '@tugla/shared';
import { AdminShell } from '../../components/AdminShell';
import { LevelEditor } from '../../components/LevelEditor';
import {
  DataTable,
  formatDate,
  StatusNote,
  useAdminAction,
  useAdminData,
} from '../../components/primitives';
import { adminApi } from '../../lib/api';
import { t } from '../../lib/i18n';

interface LevelRow {
  id: string;
  name: string;
  world: number;
  index: number;
  type: string;
  status: string;
  difficulty: number;
  publishedAt: string | null;
  updatedAt: string;
  author: { username: string } | null;
}

interface WorldRow {
  world: number;
  theme: string;
  published: number;
  total: number;
}

function LevelsInner() {
  const params = useSearchParams();
  const worldFilter = params.get('world');
  const [editor, setEditor] = useState<{
    open: boolean;
    levelId: string | null;
    initial?: LevelDefinition;
  }>({ open: false, levelId: null });
  const worlds = useAdminData<{ items: WorldRow[] }>('/admin/content/worlds');
  const levels = useAdminData<{ items: LevelRow[]; total: number }>(
    `/admin/content/levels?limit=60${worldFilter ? `&world=${worldFilter}` : ''}`,
  );
  const { run, busy, message } = useAdminAction(levels.reload);

  const openExisting = async (id: string) => {
    const level = await adminApi<{ id: string; definition: LevelDefinition }>(
      `/admin/content/levels/${id}`,
    );
    setEditor({ open: true, levelId: level.id, initial: level.definition });
  };

  if (editor.open) {
    return (
      <AdminShell title={t('levels.editorTitle')}>
        <div className="admin-toolbar">
          <button type="button" onClick={() => setEditor({ open: false, levelId: null })}>
            {t('levels.backToList')}
          </button>
        </div>
        <LevelEditor
          levelId={editor.levelId}
          initialLevel={editor.initial}
          onSaved={(id) => setEditor((current) => ({ ...current, levelId: id }))}
        />
      </AdminShell>
    );
  }

  return (
    <AdminShell title={t('levels.title')}>
      <div className="admin-toolbar">
        <button
          type="button"
          className="primary"
          onClick={() => setEditor({ open: true, levelId: null })}
        >
          {t('levels.new')}
        </button>
        {message && <span className="admin-note">{message}</span>}
      </div>

      <h2 className="admin-section-title">{t('levels.worlds')}</h2>
      <StatusNote loading={worlds.loading} error={worlds.error} />
      <div className="stat-grid">
        {(worlds.data?.items ?? []).map((world) => (
          <a key={world.world} className="stat-card" href={`/levels?world=${world.world}`}>
            <strong>
              {world.published}/{world.total}
            </strong>
            <span>
              {t('levels.world')} {world.world} · {world.theme}
            </span>
          </a>
        ))}
      </div>

      <h2 className="admin-section-title">
        {t('levels.list')}{' '}
        {worldFilter ? `(${t('levels.world')} ${worldFilter})` : `(${t('levels.all')})`} —{' '}
        {levels.data?.total ?? 0} {t('levels.records')}
      </h2>
      <StatusNote loading={levels.loading} error={levels.error} />
      <DataTable
        headers={[
          '#',
          t('levels.name'),
          t('levels.type'),
          t('common.status'),
          t('levels.difficulty'),
          t('levels.updatedAt'),
          t('common.actions'),
        ]}
        rows={(levels.data?.items ?? []).map((row) => [
          `${row.world}-${row.index}`,
          <div key="name">
            <strong>{row.name}</strong>
            {row.author && (
              <div className="admin-sub">
                {t('levels.author')}: @{row.author.username}
              </div>
            )}
          </div>,
          row.type,
          <span key="status" className={`tag tag-${row.status.toLowerCase()}`}>
            {row.status}
          </span>,
          Math.round(row.difficulty),
          formatDate(row.updatedAt),
          <div key="actions" className="admin-actions">
            <button type="button" onClick={() => void openExisting(row.id)}>
              {t('levels.edit')}
            </button>
            {row.status !== 'PUBLISHED' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    `/admin/content/levels/${row.id}/status`,
                    { method: 'POST', body: { status: 'PUBLISHED' } },
                    t('levels.published'),
                  )
                }
              >
                {t('levels.publish')}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    `/admin/content/levels/${row.id}/status`,
                    { method: 'POST', body: { status: 'ARCHIVED' } },
                    t('levels.archived'),
                  )
                }
              >
                {t('levels.archive')}
              </button>
            )}
          </div>,
        ])}
      />
    </AdminShell>
  );
}

export default function LevelsPage() {
  return (
    <Suspense fallback={null}>
      <LevelsInner />
    </Suspense>
  );
}
