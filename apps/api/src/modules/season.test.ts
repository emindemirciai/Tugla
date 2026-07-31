import { describe, expect, it } from 'vitest';
import { seasonRewardTiers } from './progression';

describe('season reward tiers', () => {
  it('parses the documented shape and orders tiers by rank', () => {
    const tiers = seasonRewardTiers({ top10: { crystals: 150 }, top1: { crystals: 500 } });
    expect(tiers.map((tier) => tier.maxRank)).toEqual([1, 10]);
    expect(tiers[0]?.payout).toEqual({ crystals: 500 });
  });

  it('ignores malformed entries instead of breaking the scheduled job', () => {
    const tiers = seasonRewardTiers({
      top1: { crystals: 100 },
      nonsense: { crystals: 5 },
      top5: 'oops',
      top3: { crystals: -10 },
    });
    expect(tiers).toHaveLength(1);
    expect(tiers[0]?.maxRank).toBe(1);
  });

  it('is safe with empty or non-object rewards', () => {
    expect(seasonRewardTiers(null)).toEqual([]);
    expect(seasonRewardTiers('nope')).toEqual([]);
    expect(seasonRewardTiers({})).toEqual([]);
  });
});
