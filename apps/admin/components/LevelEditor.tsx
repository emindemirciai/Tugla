'use client';

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createDemoLevel } from '@tugla/game-engine';
import { adminApi } from '../lib/api';
import {
  blockKinds,
  levelDefinitionSchema,
  worldThemes,
  type BlockKind,
  type LevelDefinition,
} from '@tugla/shared';

type EditorBlock = LevelDefinition['blocks'][number];

const colorByKind: Record<BlockKind, string> = {
  NORMAL: '#2dd9ff',
  TOUGH: '#7c6cff',
  ARMORED: '#ffb75e',
  EXPLOSIVE: '#ff5478',
  ICE: '#8aeeff',
  FIRE: '#ff7650',
  ELECTRIC: '#eaff65',
  MOVING: '#45f1ac',
  REGENERATING: '#65ff89',
  SHIELDED: '#6b9dff',
  PORTAL: '#d555ff',
  SPLITTER: '#ff76d8',
  BONUS: '#fff474',
  DEFLECTOR: '#b8c8d6',
  ABSORBER: '#59677a',
  BOSS_CORE: '#ff38ed',
};

const clone = <T,>(value: T): T => structuredClone(value);

export interface LevelEditorProps {
  /** Existing level being edited, if any. */
  levelId?: string | null;
  initialLevel?: LevelDefinition;
  /** Called after a successful create so the page can switch to edit mode. */
  onSaved?: (levelId: string) => void;
}

export function LevelEditor({ levelId = null, initialLevel, onSaved }: LevelEditorProps) {
  const [persistedId, setPersistedId] = useState<string | null>(levelId);
  const [level, setLevel] = useState<LevelDefinition>(() => initialLevel ?? createDemoLevel());
  const [history, setHistory] = useState<LevelDefinition[]>([]);
  const [future, setFuture] = useState<LevelDefinition[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [activeKind, setActiveKind] = useState<BlockKind>('NORMAL');
  const [gridSize, setGridSize] = useState(0.025);
  const [notice, setNotice] = useState('Taslak yerel olarak hazır.');
  const dragState = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const pushLevel = useCallback(
    (next: LevelDefinition) => {
      setHistory((items) => [...items.slice(-49), clone(level)]);
      setFuture([]);
      setLevel(next);
    },
    [level],
  );

  const update = useCallback(
    (mutator: (draft: LevelDefinition) => void) => {
      const next = clone(level);
      mutator(next);
      pushLevel(next);
    },
    [level, pushLevel],
  );

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((items) => [clone(level), ...items]);
    setHistory((items) => items.slice(0, -1));
    setLevel(previous);
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setHistory((items) => [...items, clone(level)]);
    setFuture((items) => items.slice(1));
    setLevel(next);
  };

  const snap = (value: number) => Math.max(0, Math.min(1, Math.round(value / gridSize) * gridSize));

  const boardPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: snap((event.clientX - rect.left) / rect.width),
      y: snap(1 - (event.clientY - rect.top) / rect.height),
    };
  };

  const placeBlock = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const point = boardPointer(event);
    const next = clone(level);
    const id = `block-${crypto.randomUUID()}`;
    next.blocks.push({
      id,
      kind: activeKind,
      x: point.x,
      y: point.y,
      width: 0.1,
      height: 0.04,
      hitPoints: activeKind === 'TOUGH' ? 2 : activeKind === 'BOSS_CORE' ? 100 : 1,
      rotation: 0,
      bonus: activeKind === 'BONUS' ? 'BALL_3' : null,
      required: true,
    });
    pushLevel(next);
    setSelected([id]);
  };

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>, block: EditorBlock) => {
    event.stopPropagation();
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    if (event.shiftKey) {
      setSelected((items) =>
        items.includes(block.id) ? items.filter((id) => id !== block.id) : [...items, block.id],
      );
    } else if (!selected.includes(block.id)) {
      setSelected([block.id]);
    }
    dragState.current = {
      id: block.id,
      dx: (event.clientX - rect.left) / rect.width - block.x,
      dy: 1 - (event.clientY - rect.top) / rect.height - block.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragState.current) return;
    const board = event.currentTarget.parentElement;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const x = snap((event.clientX - rect.left) / rect.width - dragState.current.dx);
    const y = snap(1 - (event.clientY - rect.top) / rect.height - dragState.current.dy);
    setLevel((current) => ({
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === dragState.current?.id ? { ...block, x, y } : block,
      ),
    }));
  };

  const endDrag = () => {
    if (!dragState.current) return;
    setHistory((items) => [...items.slice(-49), clone(level)]);
    dragState.current = null;
  };

  const removeSelected = () => {
    if (!selected.length) return;
    update((draft) => {
      draft.blocks = draft.blocks.filter((block) => !selected.includes(block.id));
    });
    setSelected([]);
  };

  const duplicateSelected = () => {
    update((draft) => {
      const copies = draft.blocks
        .filter((block) => selected.includes(block.id))
        .map((block) => ({
          ...block,
          id: `block-${crypto.randomUUID()}`,
          x: snap(block.x + gridSize),
          y: snap(block.y - gridSize),
        }));
      draft.blocks.push(...copies);
      setSelected(copies.map((block) => block.id));
    });
  };

  const mirror = () => {
    update((draft) => {
      const mirrored = draft.blocks
        .filter((block) => block.x < 0.5)
        .map((block) => ({
          ...block,
          id: `block-${crypto.randomUUID()}`,
          x: snap(1 - block.x),
        }));
      draft.blocks = [...draft.blocks.filter((block) => block.x <= 0.5), ...mirrored];
    });
  };

  const validate = () => {
    const result = levelDefinitionSchema.safeParse(level);
    setNotice(
      result.success
        ? `Doğrulandı: ${level.blocks.length} blok, ${level.blocks.filter((block) => block.required).length} zorunlu hedef.`
        : `Hata: ${result.error.issues[0]?.message ?? 'Bölüm geçersiz.'}`,
    );
  };

  /** Persists to the API: create on first save, versioned update afterwards. */
  const saveDraft = async () => {
    const parsed = levelDefinitionSchema.safeParse(level);
    if (!parsed.success) {
      setNotice(`Hata: ${parsed.error.issues[0]?.message ?? 'Bölüm geçersiz.'}`);
      return;
    }
    try {
      if (persistedId) {
        await adminApi(`/admin/content/levels/${persistedId}`, {
          method: 'PATCH',
          body: { definition: parsed.data },
        });
        setNotice('Yeni sürüm kaydedildi (sürüm geçmişinde saklanır).');
      } else {
        const created = await adminApi<{ id: string }>('/admin/content/levels', {
          method: 'POST',
          body: { definition: parsed.data },
        });
        setPersistedId(created.id);
        onSaved?.(created.id);
        setNotice('Bölüm TASLAK olarak oluşturuldu. Yayınlamayı bölüm listesinden yapabilirsin.');
      }
    } catch (saveError) {
      setNotice(
        saveError instanceof Error ? `Sunucu hatası: ${saveError.message}` : 'Kaydetme başarısız.',
      );
    }
  };

  /** Pulls the deterministic campaign definition for an index as a scaffold. */
  const loadGenerated = async () => {
    const raw = window.prompt('Kampanya bölüm numarası (1-500):');
    if (!raw) return;
    const index = Number(raw);
    if (!Number.isInteger(index) || index < 1) {
      setNotice('Geçerli bir bölüm numarası gir.');
      return;
    }
    try {
      const generated = await adminApi<LevelDefinition>(`/admin/content/levels/generate/${index}`);
      pushLevel(generated);
      setNotice(
        `Kampanya ${index} şablonu yüklendi; düzenleyip yeni bölüm olarak kaydedebilirsin.`,
      );
    } catch {
      setNotice('Şablon alınamadı.');
    }
  };

  const metrics = useMemo(() => {
    const hitPoints = level.blocks.reduce((total, block) => total + block.hitPoints, 0);
    const special = level.blocks.filter((block) => block.kind !== 'NORMAL').length;
    return {
      hitPoints,
      special,
      difficulty: Math.min(10, Math.max(1, (hitPoints + special * 2) / 30)).toFixed(1),
    };
  }, [level.blocks]);

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <div className="admin-brand">
          <span className="brand-icon">P</span>
          <div>
            <strong>TUĞLA</strong>
            <small>CONTROL CENTER</small>
          </div>
        </div>
        <nav>
          <button className="active">▦ Level Editor</button>
          <button>◈ Worlds</button>
          <button>⌁ Bosses</button>
          <button>✦ Bonuses</button>
          <button>♙ Players</button>
          <button>♜ Leagues</button>
          <button>✓ Missions</button>
          <button>◇ Economy</button>
          <button>⚑ Moderation</button>
          <button>◉ Analytics</button>
          <button>⚙ System</button>
        </nav>
        <div className="environment">
          <i />
          <div>
            <span>ENVIRONMENT</span>
            <strong>STAGING</strong>
          </div>
        </div>
      </aside>

      <section className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <span>CONTENT / WORLDS / NEON GRID</span>
            <h1>{level.name}</h1>
          </div>
          <div className="top-actions">
            <button onClick={validate}>Validate</button>
            <button onClick={loadGenerated}>Kampanyadan yükle</button>
            <button className="primary" onClick={saveDraft}>
              Save draft
            </button>
          </div>
        </header>

        <div className="editor-toolbar">
          <div>
            <button onClick={undo} disabled={!history.length} title="Undo">
              ↶
            </button>
            <button onClick={redo} disabled={!future.length} title="Redo">
              ↷
            </button>
            <button onClick={duplicateSelected} disabled={!selected.length} title="Duplicate">
              ⧉
            </button>
            <button onClick={removeSelected} disabled={!selected.length} title="Delete">
              ⌫
            </button>
            <button onClick={mirror} title="Mirror left to right">
              ⋈
            </button>
          </div>
          <div className="toolbar-meta">
            <label>
              GRID
              <select
                value={gridSize}
                onChange={(event) => setGridSize(Number(event.target.value))}
              >
                <option value={0.0125}>80 × 80</option>
                <option value={0.025}>40 × 40</option>
                <option value={0.05}>20 × 20</option>
              </select>
            </label>
            <span>Selected {selected.length}</span>
          </div>
        </div>

        <div className="editor-body">
          <aside className="block-palette">
            <div className="panel-heading">
              <span>BLOCK LIBRARY</span>
              <small>{blockKinds.length} TYPES</small>
            </div>
            <div className="palette-grid">
              {blockKinds.map((kind) => (
                <button
                  key={kind}
                  className={activeKind === kind ? 'active' : ''}
                  onClick={() => setActiveKind(kind)}
                >
                  <i style={{ background: colorByKind[kind] }} />
                  <span>{kind.replace('_', ' ')}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="editor-center">
            <div className="canvas-meta">
              <span>PORTRAIT · 9:16</span>
              <span>{notice}</span>
            </div>
            <div
              className="level-board"
              onPointerDown={placeBlock}
              style={{
                backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
              }}
            >
              <div className="danger-line">DANGER LINE</div>
              {level.blocks.map((block) => (
                <button
                  key={block.id}
                  className={`editor-block ${selected.includes(block.id) ? 'selected' : ''}`}
                  aria-label={`${block.kind} block`}
                  onPointerDown={(event) => beginDrag(event, block)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  style={{
                    left: `${block.x * 100}%`,
                    bottom: `${block.y * 100}%`,
                    width: `${block.width * 100}%`,
                    height: `${block.height * 100}%`,
                    background: colorByKind[block.kind],
                    transform: `translate(-50%, 50%) rotate(${block.rotation}deg)`,
                  }}
                >
                  {block.hitPoints > 1 ? block.hitPoints : ''}
                </button>
              ))}
              <div className="editor-paddle" />
            </div>
            <div className="zoom-row">
              <span>Click empty space to add · Shift-click to multi-select</span>
              <strong>100%</strong>
            </div>
          </section>

          <aside className="inspector">
            <div className="panel-heading">
              <span>LEVEL SETTINGS</span>
              <small>V{level.version}</small>
            </div>
            <label>
              NAME
              <input
                value={level.name}
                onChange={(event) => setLevel({ ...level, name: event.target.value })}
              />
            </label>
            <div className="field-row">
              <label>
                WORLD
                <input
                  type="number"
                  min={1}
                  value={level.world}
                  onChange={(event) => setLevel({ ...level, world: Number(event.target.value) })}
                />
              </label>
              <label>
                INDEX
                <input
                  type="number"
                  min={1}
                  value={level.index}
                  onChange={(event) => setLevel({ ...level, index: Number(event.target.value) })}
                />
              </label>
            </div>
            <label>
              THEME
              <select
                value={level.theme}
                onChange={(event) => setLevel({ ...level, theme: event.target.value })}
              >
                {worldThemes.map((theme) => (
                  <option value={theme} key={theme}>
                    {theme.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label>
              LEVEL TYPE
              <select
                value={level.type}
                onChange={(event) =>
                  setLevel({ ...level, type: event.target.value as LevelDefinition['type'] })
                }
              >
                <option>NORMAL</option>
                <option>MINI_BOSS</option>
                <option>WORLD_BOSS</option>
                <option>DAILY</option>
                <option>COMMUNITY</option>
              </select>
            </label>
            <div className="difficulty">
              <div>
                <span>EST. DIFFICULTY</span>
                <strong>{metrics.difficulty} / 10</strong>
              </div>
              <progress max={10} value={metrics.difficulty} />
            </div>
            <div className="metric-grid">
              <div>
                <span>BLOCKS</span>
                <strong>{level.blocks.length}</strong>
              </div>
              <div>
                <span>TOTAL HP</span>
                <strong>{metrics.hitPoints}</strong>
              </div>
              <div>
                <span>SPECIAL</span>
                <strong>{metrics.special}</strong>
              </div>
              <div>
                <span>SEED</span>
                <strong>{level.seed}</strong>
              </div>
            </div>
            {selected.length === 1 && (
              <SelectedInspector
                block={level.blocks.find((block) => block.id === selected[0])}
                onChange={(changed) =>
                  setLevel({
                    ...level,
                    blocks: level.blocks.map((block) =>
                      block.id === changed.id ? changed : block,
                    ),
                  })
                }
              />
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

function SelectedInspector({
  block,
  onChange,
}: {
  block?: EditorBlock;
  onChange: (block: EditorBlock) => void;
}) {
  if (!block) return null;
  return (
    <div className="selected-inspector">
      <div className="panel-heading">
        <span>SELECTED BLOCK</span>
      </div>
      <label>
        TYPE
        <select
          value={block.kind}
          onChange={(event) => onChange({ ...block, kind: event.target.value as BlockKind })}
        >
          {blockKinds.map((kind) => (
            <option key={kind}>{kind}</option>
          ))}
        </select>
      </label>
      <label>
        HIT POINTS
        <input
          type="number"
          min={1}
          max={1_000_000}
          value={block.hitPoints}
          onChange={(event) => onChange({ ...block, hitPoints: Number(event.target.value) })}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={block.required}
          onChange={(event) => onChange({ ...block, required: event.target.checked })}
        />
        Required objective
      </label>
    </div>
  );
}
