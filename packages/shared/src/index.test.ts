import { describe, expect, it } from 'vitest';
import { APP_DEFAULTS, levelDefinitionSchema } from './index';

describe('shared contracts', () => {
  it('keeps the ball cap explicit', () => {
    expect(APP_DEFAULTS.maxBalls).toBe(500);
  });

  it('rejects levels without blocks', () => {
    expect(() =>
      levelDefinitionSchema.parse({
        version: 1,
        name: 'Empty',
        type: 'NORMAL',
        world: 1,
        index: 1,
        theme: 'neon-grid',
        seed: 1,
        blocks: [],
      }),
    ).toThrow();
  });
});
