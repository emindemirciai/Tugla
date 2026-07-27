import { describe, expect, it } from 'vitest';
import { registerSchema } from '@tugla/shared';

describe('authentication contract', () => {
  it('requires explicit terms acceptance', () => {
    const result = registerSchema.safeParse({
      email: 'player@example.com',
      password: 'long-enough-password',
      displayName: 'Player',
      locale: 'tr',
      acceptedTerms: false,
    });
    expect(result.success).toBe(false);
  });
});
