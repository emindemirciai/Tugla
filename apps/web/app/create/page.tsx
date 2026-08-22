'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BlockKind, LevelDefinition } from '@tugla/shared';
/**
 * The renderer arrives with the game, not with the page.
 *
 * GameCanvas pulls in three.js, which is the bulk of this route's JavaScript.
 * The hub is a list of levels: nobody needs a 3D renderer to read it, and on a
 * phone that download is the difference between an instant screen and a wait.
 * Loading it when a session starts costs a moment nobody notices, because the
 * level is starting anyway.
 */
const GameCanvas = dynamic(
  () => import('../../components/GameCanvas').then((module) => module.GameCanvas),
  { ssr: false },
);
import { HubStatus, PlayerShell } from '../../components/PlayerNav';
import { gameApi, platformApi, type SessionStart } from '../../lib/api';
import { useRequirePlayer } from '../../lib/guard';
import { useI18n, type TranslationKey } from '../../lib/i18n';

const COLUMNS = 9;
const ROWS = 12;
const THEMES = ['neon-grid', 'crystal-core', 'solar-forge', 'dark-matter', 'singularity'];
const BRUSHES: { kind: BlockKind; hitPoints: number; label: string }[] = [
  { kind: 'NORMAL', hitPoints: 1, label: 'N' },
  { kind: 'TOUGH', hitPoints: 3, label: 'T' },
  { kind: 'ARMORED', hitPoints: 6, label: 'A' },
  { kind: 'EXPLOSIVE', hitPoints: 2, label: 'X' },
  { kind: 'ICE', hitPoints: 2, label: 'I' },
  { kind: 'BONUS', hitPoints: 1, label: 'B' },
];

type Cell = { kind: BlockKind; hitPoints: number } | null;
type MyLevel = Awaited<ReturnType<typeof gameApi.myCommunityLevels>>['items'][number];

const emptyGrid = (): Cell[] => Array.from({ length: COLUMNS * ROWS }, () => null);

/** Grid to schema-valid definition (normalised 0..1 coordinates). */
const toDefinition = (grid: Cell[], name: string, theme: string): LevelDefinition => {
  const width = 1 / COLUMNS;
  const height = 0.6 / ROWS;
  const blocks = grid.flatMap((cell, index) => {
    if (!cell) return [];
    const column = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    return [
      {
        id: `b${index}`,
        kind: cell.kind,
        x: column * width,
        y: 0.08 + row * height,
        width: width * 0.94,
        height: height * 0.9,
        hitPoints: cell.hitPoints,
        rotation: 0,
        required: cell.kind !== 'BONUS',
      },
    ];
  });
  return {
    version: 1,
    name,
    type: 'COMMUNITY',
    world: 1000,
    index: 1,
    theme,
    seed: 1,
    blocks,
    metadata: { authoring: 'player-editor', columns: COLUMNS, rows: ROWS },
  };
};

/** Definition back to a grid so an existing draft can be reopened. */
const toGrid = (definition: LevelDefinition): Cell[] => {
  const grid = emptyGrid();
  const width = 1 / COLUMNS;
  const height = 0.6 / ROWS;
  for (const block of definition.blocks) {
    const column = Math.round(block.x / width);
    const row = Math.round((block.y - 0.08) / height);
    const index = row * COLUMNS + column;
    if (index >= 0 && index < grid.length) {
      grid[index] = { kind: block.kind, hitPoints: block.hitPoints };
    }
  }
  return grid;
};

export default function CreatePage() {
  const { t, locale } = useI18n();
  const { ready } = useRequirePlayer();

  const [levels, setLevels] = useState<MyLevel[]>([]);
  const [limit, setLimit] = useState(20);
  const [community, setCommunity] = useState<
    Awaited<ReturnType<typeof gameApi.communityLevels>>['items']
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<'top' | 'new'>('top');

  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [grid, setGrid] = useState<Cell[]>(emptyGrid);
  const [name, setName] = useState('');
  const [theme, setTheme] = useState<string>(THEMES[0] ?? 'neon-grid');
  const [brush, setBrush] = useState(0);
  const [session, setSession] = useState<SessionStart | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mine, published] = await Promise.all([
        gameApi.myCommunityLevels(),
        gameApi.communityLevels(sort),
      ]);
      setLevels(mine.items);
      setLimit(mine.limit);
      setCommunity(published.items);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('common.unexpectedError'));
    } finally {
      setLoading(false);
    }
    // `sort` is a dependency: changing it has to refetch, not just re-render.
  }, [t, sort]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const blockCount = useMemo(() => grid.filter(Boolean).length, [grid]);

  if (!ready) return null;
  if (session) return <GameCanvas session={session} onExit={() => setSession(null)} />;

  const paint = (index: number) => {
    setGrid((current) => {
      const next = [...current];
      const selected = BRUSHES[brush];
      next[index] = selected ? { kind: selected.kind, hitPoints: selected.hitPoints } : null;
      return next;
    });
  };

  const openEditor = async (level?: MyLevel) => {
    setNotice(null);
    if (!level) {
      setGrid(emptyGrid());
      setName('');
      setTheme(THEMES[0] ?? 'neon-grid');
      setEditing({ id: null });
      return;
    }
    if (level.status === 'REVIEW' || level.status === 'PUBLISHED') {
      setNotice(t('create.editLocked'));
      return;
    }
    const detail = await gameApi.communityLevel(level.id);
    const definition = detail.definition as LevelDefinition;
    setGrid(toGrid(definition));
    setName(detail.name);
    setTheme(detail.theme);
    setEditing({ id: level.id });
  };

  const save = async () => {
    if (name.trim().length < 3) {
      setNotice(t('create.needName'));
      return;
    }
    if (blockCount < 5) {
      setNotice(t('create.needBlocks'));
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: name.trim(),
        definition: toDefinition(grid, name.trim(), theme ?? THEMES[0] ?? 'neon-grid'),
      };
      const saved = editing?.id
        ? await gameApi.updateCommunityLevel(editing.id, body)
        : await gameApi.createCommunityLevel(body);
      setEditing({ id: saved.id });
      setNotice(t('create.saved'));
      await load();
    } catch (saveError) {
      setNotice(saveError instanceof Error ? saveError.message : t('create.failed'));
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice(message);
      await load();
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : t('create.failed'));
    } finally {
      setBusy(false);
    }
  };

  const rate = async (levelId: string, liked: boolean, current: boolean | null) => {
    setBusy(true);
    setNotice(null);
    try {
      // Tapping the active thumb clears the rating.
      if (current === liked) await gameApi.clearCommunityRating(levelId);
      else await gameApi.rateCommunityLevel(levelId, liked);
      setNotice(t('create.rated'));
      await load();
    } catch (rateError) {
      setNotice(rateError instanceof Error ? rateError.message : t('create.failed'));
    } finally {
      setBusy(false);
    }
  };

  const report = async (
    levelId: string,
    reason: 'ABUSE' | 'SPAM' | 'INAPPROPRIATE' | 'CHEATING' | 'OTHER',
  ) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await platformApi.report({ targetType: 'LEVEL', targetId: levelId, reason });
      setNotice(result.duplicate ? t('create.reportDuplicate') : t('create.reportSent'));
      setReporting(null);
      await load();
    } catch (reportError) {
      setNotice(reportError instanceof Error ? reportError.message : t('create.failed'));
    } finally {
      setBusy(false);
    }
  };

  const testPlay = async (levelId: string) => {
    setBusy(true);
    try {
      setSession(await gameApi.startSession(levelId, 'COMMUNITY'));
    } catch (playError) {
      setNotice(playError instanceof Error ? playError.message : t('create.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PlayerShell title={t('create.title')}>
      <p className="loading-note">{t('create.intro')}</p>
      {notice && <div className="banner">{notice}</div>}
      <HubStatus loading={loading} error={error} />

      {editing ? (
        <>
          <div className="hub-toolbar">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('create.name')}
              aria-label={t('create.name')}
              maxLength={60}
            />
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
              aria-label={t('create.theme')}
            >
              {THEMES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry.replace('-', ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="brush-row" role="group" aria-label={t('create.brush')}>
            {BRUSHES.map((entry, index) => (
              <button
                key={entry.kind}
                type="button"
                className={`brush brush-${entry.kind.toLowerCase()} ${brush === index ? 'active' : ''}`}
                onClick={() => setBrush(index)}
                title={`${entry.kind} - ${entry.hitPoints} HP`}
              >
                {entry.label}
              </button>
            ))}
            <button
              type="button"
              className={`brush brush-erase ${brush === -1 ? 'active' : ''}`}
              onClick={() => setBrush(-1)}
            >
              {t('create.erase')}
            </button>
            <span className="muted">{t('create.blocks', { count: blockCount })}</span>
          </div>

          <div
            className="editor-grid"
            style={{ gridTemplateColumns: `repeat(${COLUMNS}, 1fr)` }}
            role="group"
            aria-label={t('create.grid')}
          >
            {grid.map((cell, index) => (
              <button
                key={index}
                type="button"
                className={`editor-cell ${cell ? `filled cell-${cell.kind.toLowerCase()}` : ''}`}
                onClick={() => paint(index)}
                aria-label={String(index)}
              />
            ))}
          </div>

          <div className="hub-toolbar">
            <button
              type="button"
              className="button button-primary"
              disabled={busy}
              onClick={() => void save()}
            >
              {t('create.save')}
            </button>
            {editing.id && (
              <>
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => void testPlay(String(editing.id))}
                >
                  {t('create.test')}
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      () => gameApi.submitCommunityLevel(String(editing.id)),
                      t('create.submitted'),
                    )
                  }
                >
                  {t('create.submit')}
                </button>
              </>
            )}
            <button type="button" className="button-quiet" onClick={() => setEditing(null)}>
              {t('create.cancel')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="hub-toolbar">
            <button
              type="button"
              className="button button-primary"
              disabled={levels.length >= limit}
              onClick={() => void openEditor()}
            >
              {t('create.new')}
            </button>
            <span className="muted">{t('create.limit', { used: levels.length, limit })}</span>
            {levels.length >= limit && <span className="muted">{t('create.limitReached')}</span>}
          </div>

          {!loading && levels.length === 0 ? (
            <p className="loading-note">{t('create.empty')}</p>
          ) : (
            <ul className="card-list">
              {levels.map((level) => (
                <li key={level.id} className="card">
                  <div className="card-head">
                    <strong>{level.name}</strong>
                    <span className={`tag tag-${level.status.toLowerCase()}`}>
                      {t(`create.status.${level.status}` as TranslationKey)}
                    </span>
                  </div>
                  <div className="card-foot">
                    <span className="muted">
                      {level.theme} - {new Date(level.updatedAt).toLocaleDateString(locale)}
                    </span>
                    <div className="card-actions">
                      <button
                        type="button"
                        className="button-quiet"
                        onClick={() => void openEditor(level)}
                      >
                        {t('create.edit')}
                      </button>
                      <button
                        type="button"
                        className="button-quiet"
                        disabled={busy}
                        onClick={() => void testPlay(level.id)}
                      >
                        {t('create.test')}
                      </button>
                      {level.status !== 'PUBLISHED' && (
                        <button
                          type="button"
                          className="button-quiet"
                          disabled={busy}
                          onClick={() =>
                            void act(
                              () => gameApi.deleteCommunityLevel(level.id),
                              t('create.deleted'),
                            )
                          }
                        >
                          {t('create.delete')}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="section-head">
            <h2 className="hub-section">{t('create.community')}</h2>
            {/* Sorting only by likes buries every new level under the same few
                forever, and a creation loop dies when nobody can be found. */}
            <div className="segmented">
              {(['top', 'new'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={sort === option ? 'active' : ''}
                  onClick={() => setSort(option)}
                >
                  {t(option === 'top' ? 'create.sortTop' : 'create.sortNew')}
                </button>
              ))}
            </div>
          </div>
          {community.length === 0 ? (
            <p className="loading-note">{t('create.communityEmpty')}</p>
          ) : (
            <ul className="card-list">
              {community.map((level) => (
                <li key={level.id} className="card">
                  <div className="card-head">
                    <strong>{level.name}</strong>
                    <span className="muted">
                      {t('create.by')} @{level.author?.username ?? '-'}
                      {level.isMine ? ` · ${t('create.mine')}` : ''}
                    </span>
                  </div>
                  <div className="card-foot">
                    <div className="rating-row">
                      <button
                        type="button"
                        className={`rating ${level.myRating === true ? 'active' : ''}`}
                        disabled={busy || level.isMine}
                        title={level.isMine ? t('create.rateOwn') : t('create.like')}
                        aria-label={t('create.like')}
                        onClick={() => void rate(level.id, true, level.myRating)}
                      >
                        ▲ {level.likes}
                      </button>
                      <button
                        type="button"
                        className={`rating ${level.myRating === false ? 'active' : ''}`}
                        disabled={busy || level.isMine}
                        title={level.isMine ? t('create.rateOwn') : t('create.dislike')}
                        aria-label={t('create.dislike')}
                        onClick={() => void rate(level.id, false, level.myRating)}
                      >
                        ▼ {level.dislikes}
                      </button>
                      {!level.isMine && (
                        <button
                          type="button"
                          className="button-quiet"
                          onClick={() => setReporting(reporting === level.id ? null : level.id)}
                        >
                          {t('create.report')}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      className="button"
                      disabled={busy}
                      onClick={() => void testPlay(level.id)}
                    >
                      {t('create.play')}
                    </button>
                  </div>
                  {reporting === level.id && (
                    <div className="report-row" role="group" aria-label={t('create.reportReason')}>
                      {(['ABUSE', 'SPAM', 'INAPPROPRIATE', 'CHEATING', 'OTHER'] as const).map(
                        (reason) => (
                          <button
                            key={reason}
                            type="button"
                            className="button-quiet"
                            disabled={busy}
                            onClick={() => void report(level.id, reason)}
                          >
                            {t(`create.reason.${reason}` as TranslationKey)}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PlayerShell>
  );
}
