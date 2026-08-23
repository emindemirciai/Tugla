import { describe, expect, it, vi } from 'vitest';
import { GameController, GameService } from './game';

const level51 = {
  id: '00000000-0000-4000-8000-000000000051',
  slug: 'level-51',
  name: 'Level 51',
  world: 2,
  index: 51,
  type: 'NORMAL',
  theme: 'neon-grid',
  status: 'PUBLISHED',
  difficulty: 2,
  estimatedSeconds: 180,
  definition: {},
};

describe('campaign level progression', () => {
  it('unlocks the first level of a world after the previous global index is cleared', async () => {
    const levelFindMany = vi
      .fn()
      .mockResolvedValueOnce([level51])
      .mockResolvedValueOnce([{ id: 'level-50', world: 1, index: 50 }]);
    const sessionFindMany = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ levelId: 'level-50' }]);
    const database = {
      client: {
        level: { findMany: levelFindMany },
        gameSession: { findMany: sessionFindMany },
      },
    };
    const controller = new GameController({} as never, database as never, {} as never, {} as never);

    const response = await controller.levels({ user: { sub: 'player-1' } } as never, {
      world: 2,
      limit: 50,
    });

    expect(response.items[0]).toMatchObject({ index: 51, unlocked: true });
    expect(levelFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ OR: [{ world: 1, index: 50 }] }),
      }),
    );
  });

  it('ignores duplicate indexes and noncanonical rows outside the exact predecessor coordinate', async () => {
    const level50 = { id: 'level-50', world: 1, index: 50 };
    const duplicateIndex = { id: 'world-1-level-51', world: 1, index: 51 };
    const insertedRow = { id: 'world-2-level-1', world: 2, index: 1 };
    const published = [level50, duplicateIndex, insertedRow, level51];
    const levelFindMany = vi
      .fn()
      .mockResolvedValueOnce([level51])
      .mockImplementationOnce((query: { where: { OR: { world: number; index: number }[] } }) =>
        published.filter((level) =>
          query.where.OR.some(
            (coordinate) => coordinate.world === level.world && coordinate.index === level.index,
          ),
        ),
      );
    const sessionFindMany = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ levelId: level50.id }]);
    const database = {
      client: {
        level: { findMany: levelFindMany },
        gameSession: { findMany: sessionFindMany },
      },
    };
    const controller = new GameController({} as never, database as never, {} as never, {} as never);

    const response = await controller.levels({ user: { sub: 'player-1' } } as never, {
      world: 2,
      limit: 50,
    });

    expect(response.items[0]).toMatchObject({ id: level51.id, unlocked: true });
    expect(sessionFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ levelId: { in: [level50.id] } }),
      }),
    );
  });

  it('allows starting level 51 when level 50 was cleared in the previous world', async () => {
    const levelFindFirst = vi
      .fn()
      .mockResolvedValueOnce(level51)
      .mockResolvedValueOnce({ id: 'level-50' });
    const gameSession = {
      count: vi.fn().mockResolvedValue(1),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({ id: 'session-51' }),
    };
    const inventoryItem = { findMany: vi.fn().mockResolvedValue([]) };
    const database = {
      client: { level: { findFirst: levelFindFirst }, gameSession, inventoryItem },
    };
    const redis = { safe: vi.fn().mockResolvedValue(undefined) };
    const service = new GameService(database as never, redis as never, {} as never, {} as never);

    await expect(
      service.start('player-1', { levelId: level51.id, mode: 'CAMPAIGN' }),
    ).resolves.toMatchObject({ sessionId: 'session-51', cosmetics: [] });
    expect(inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'player-1', equipped: true } }),
    );
    expect(levelFindFirst).toHaveBeenNthCalledWith(2, {
      where: {
        world: 1,
        index: 50,
        status: 'PUBLISHED',
        type: { not: 'COMMUNITY' },
      },
      select: { id: true },
    });
  });
});
