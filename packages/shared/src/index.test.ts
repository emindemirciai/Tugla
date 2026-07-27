import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  APP_DEFAULTS,
  decodeReplay,
  encodeReplay,
  levelDefinitionSchema,
  levelTypeForIndex,
  readBrand,
  registerSchema,
  sessionChecksum,
  sha256Hex,
  type ReplayDocument,
} from './index';

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

  it('requires explicit terms acceptance and a strong password', () => {
    const base = {
      email: 'player@example.com',
      displayName: 'Player',
      locale: 'tr' as const,
    };
    expect(
      registerSchema.safeParse({ ...base, password: 'sufficient1', acceptedTerms: false }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ ...base, password: 'onlyletters', acceptedTerms: true }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ ...base, password: 'sufficient1', acceptedTerms: true }).success,
    ).toBe(true);
  });

  it('marks every 10th level a mini boss and every 50th a world boss', () => {
    expect(levelTypeForIndex(9)).toBe('NORMAL');
    expect(levelTypeForIndex(10)).toBe('MINI_BOSS');
    expect(levelTypeForIndex(50)).toBe('WORLD_BOSS');
    expect(levelTypeForIndex(100)).toBe('WORLD_BOSS');
  });
});

describe('brand configuration', () => {
  it('derives every public surface from the environment', () => {
    const brand = readBrand({
      APP_NAME: 'Nova',
      APP_SLUG: 'nova',
      ROOT_DOMAIN: 'nova.example',
      WEB_URL: 'https://nova.example',
    });
    expect(brand.name).toBe('Nova');
    expect(brand.webUrl).toBe('https://nova.example');
    expect(brand.supportEmail).toBe('support@nova.example');
  });
});

describe('session checksum', () => {
  it('matches the Node crypto implementation byte for byte', () => {
    const message = 'pulse|deterministic|payload';
    expect(sha256Hex(message)).toBe(createHash('sha256').update(message).digest('hex'));
  });

  it('hashes long multi-block payloads correctly', () => {
    const message = 'x'.repeat(1000);
    expect(sha256Hex(message)).toBe(createHash('sha256').update(message).digest('hex'));
  });

  it('changes when any reported field changes', () => {
    const base = {
      sessionId: 'ffffffff-ffff-4fff-bfff-ffffffffffff',
      nonce: 'nonce',
      seed: 42,
      score: 1000,
      durationMs: 30000,
      blocksDestroyed: 40,
      eventCount: 120,
      finalTick: 3600,
      livesRemaining: 3,
      maxBalls: 12,
    };
    expect(sessionChecksum(base)).toHaveLength(64);
    expect(sessionChecksum(base)).not.toBe(sessionChecksum({ ...base, score: 1001 }));
  });
});

describe('replay codec', () => {
  it('round-trips a document through the compact wire format', () => {
    const document: ReplayDocument = {
      version: 1,
      seed: 7,
      levelId: 'level-1',
      width: 9,
      height: 16,
      fixedStep: 1 / 120,
      maxBalls: 500,
      lives: 5,
      inputs: [
        { t: 0, k: 'm', v: 4.5 },
        { t: 12, k: 'l', v: 0 },
      ],
      finalTick: 900,
      score: 5400,
    };
    expect(decodeReplay(encodeReplay(document))).toEqual(document);
  });
});
