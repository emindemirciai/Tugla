import { describe, expect, it } from 'vitest';
import type { LevelSummary } from './api';
import { applyAcceptedCompletion } from './level-progression';

const level = (index: number, unlocked: boolean): LevelSummary => ({
  id: `level-${index}`,
  slug: `level-${index}`,
  name: `Level ${index}`,
  world: 1,
  index,
  type: 'NORMAL',
  theme: 'neon-grid',
  difficulty: 1,
  estimatedSeconds: 180,
  unlocked,
  completed: false,
});

describe('campaign completion cards', () => {
  it('marks the cleared level complete and unlocks its successor', () => {
    const levels = [level(7, true), level(8, false), level(9, false)];

    const updated = applyAcceptedCompletion(levels, 7, {
      accepted: true,
      status: 'COMPLETED',
    });

    expect(updated[0]).toMatchObject({ index: 7, completed: true, unlocked: true });
    expect(updated[1]).toMatchObject({ index: 8, completed: false, unlocked: true });
    expect(updated[2]).toMatchObject({ index: 9, completed: false, unlocked: false });
  });

  it('does not unlock anything for a rejected result', () => {
    const levels = [level(7, true), level(8, false)];

    expect(applyAcceptedCompletion(levels, 7, { accepted: false, status: 'FLAGGED' })).toBe(levels);
  });
});
