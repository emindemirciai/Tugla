import { describe, expect, it } from 'vitest';
import { generateCampaignLevel } from './levels';
import { ballSpeedForLevel } from './engine';

describe('campaign level variety', () => {
  it('spreads every silhouette evenly across the campaign', () => {
    const counts = new Map<string, number>();
    for (let index = 1; index <= 500; index += 1) {
      const layout = String(generateCampaignLevel(index).metadata.layout);
      counts.set(layout, (counts.get(layout) ?? 0) + 1);
    }
    expect(counts.size).toBe(10);
    for (const count of counts.values()) expect(count).toBe(50);
  });

  it('does not put every boss on the same board', () => {
    const bossLayouts = new Set(
      [10, 20, 30, 50, 100].map((index) => String(generateCampaignLevel(index).metadata.layout)),
    );
    expect(bossLayouts.size).toBeGreaterThan(1);
  });

  it('always leaves a playable board', () => {
    for (let index = 1; index <= 500; index += 1) {
      const level = generateCampaignLevel(index);
      expect(level.blocks.length).toBeGreaterThan(5);
      expect(level.blocks.every((block) => block.y > 0.24)).toBe(true);
    }
  });

  it('is deterministic, so server verification rebuilds the same board', () => {
    const first = generateCampaignLevel(137);
    const second = generateCampaignLevel(137);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe('ball speed', () => {
  it('ramps up with the world', () => {
    expect(ballSpeedForLevel({ world: 5, index: 210 })).toBeGreaterThan(
      ballSpeedForLevel({ world: 1, index: 10 }),
    );
  });

  it('gives boss rooms extra pace', () => {
    expect(ballSpeedForLevel({ world: 2, index: 60, type: 'WORLD_BOSS' })).toBeGreaterThan(
      ballSpeedForLevel({ world: 2, index: 60 }),
    );
  });

  it('stays inside a playable band', () => {
    for (let index = 1; index <= 500; index += 1) {
      const speed = ballSpeedForLevel({ world: Math.ceil(index / 50), index });
      expect(speed).toBeGreaterThanOrEqual(6);
      expect(speed).toBeLessThanOrEqual(11);
    }
  });
});
