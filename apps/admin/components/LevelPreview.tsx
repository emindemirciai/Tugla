'use client';

import { colorByKind } from './LevelEditor';

interface PreviewBlock {
  id: string;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

/**
 * Read-only board.
 *
 * Moderation used to show "LEVEL · a1b2c3d4" and ask for a verdict on content
 * nobody could see. This renders the reported level exactly where it is being
 * judged — small, static and without the editor's drag handlers, because a
 * moderator should be able to look without being able to change anything.
 */
export function LevelPreview({ definition }: { definition: unknown }) {
  const blocks =
    definition &&
    typeof definition === 'object' &&
    Array.isArray((definition as { blocks?: unknown }).blocks)
      ? ((definition as { blocks: PreviewBlock[] }).blocks ?? [])
      : [];

  if (!blocks.length) return null;

  return (
    <div className="level-preview" aria-hidden>
      {blocks.map((block) => (
        <span
          key={block.id}
          style={{
            left: `${block.x * 100}%`,
            bottom: `${block.y * 100}%`,
            width: `${block.width * 100}%`,
            height: `${block.height * 100}%`,
            // The definition is stored JSON, so a kind this build does not know
            // is possible; it draws grey rather than disappearing.
            background: (colorByKind as Record<string, string>)[block.kind] ?? '#94a3b8',
            transform: `translate(-50%, 50%) rotate(${block.rotation ?? 0}deg)`,
          }}
        />
      ))}
    </div>
  );
}
