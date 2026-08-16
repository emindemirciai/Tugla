import { describe, expect, it } from 'vitest';
import { AVATAR_TYPES, describeAvatarError } from './avatar';

const fileOf = (type: string, size: number) => ({ type, size, name: 'avatar' }) as unknown as File;

describe('avatar validation', () => {
  it('accepts the formats the server accepts', () => {
    for (const type of AVATAR_TYPES) {
      expect(describeAvatarError(fileOf(type, 1024))).toBeNull();
    }
  });

  it('rejects a format the server would refuse anyway', () => {
    expect(describeAvatarError(fileOf('image/gif', 1024))).toBe('type');
    expect(describeAvatarError(fileOf('application/pdf', 1024))).toBe('type');
  });

  it('rejects a file too large to be worth decoding', () => {
    expect(describeAvatarError(fileOf('image/png', 11 * 1024 * 1024))).toBe('size');
  });

  it('allows a large source that the canvas step will shrink', () => {
    expect(describeAvatarError(fileOf('image/jpeg', 6 * 1024 * 1024))).toBeNull();
  });
});
