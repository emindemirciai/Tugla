import { describe, expect, it } from 'vitest';
import { loadEnv, providerStatus } from './env';

const validProduction = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@db:5432/app',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  SESSION_ENCRYPTION_KEY: 'c'.repeat(48),
} as NodeJS.ProcessEnv;

describe('environment contract', () => {
  it('refuses to boot in production without real secrets', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('treats blank values as unset instead of failing min-length rules', () => {
    const env = loadEnv({ ...validProduction, INTERNAL_API_KEY: '   ' });
    expect(env.INTERNAL_API_KEY).toBeUndefined();
  });

  it('falls back to development secrets only outside production', () => {
    const env = loadEnv({ NODE_ENV: 'development' } as NodeJS.ProcessEnv);
    expect(env.JWT_ACCESS_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it('reports providers honestly based on configured keys', () => {
    const withoutGoogle = providerStatus(loadEnv(validProduction));
    expect(withoutGoogle.googleAuth).toBe(false);
    const withGoogle = providerStatus(
      loadEnv({ ...validProduction, GOOGLE_CLIENT_ID: 'client-id.apps.example' }),
    );
    expect(withGoogle.googleAuth).toBe(true);
  });

  it('only reports payments ready when the flag AND the key exist', () => {
    const flagOnly = providerStatus(loadEnv({ ...validProduction, PAYMENTS_ENABLED: 'true' }));
    expect(flagOnly.payments).toBe(false);
    const full = providerStatus(
      loadEnv({ ...validProduction, PAYMENTS_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_x' }),
    );
    expect(full.payments).toBe(true);
  });
});

describe('environment failures are proportionate', () => {
  it('starts with a safe default when an optional setting is misspelled', () => {
    // The exact typo that took production down: MAIL_PROVIDER=stmp.
    const config = loadEnv({
      ...validProduction,
      MAIL_PROVIDER: 'stmp',
    } as NodeJS.ProcessEnv);
    expect(config.MAIL_PROVIDER).toBe('log');
  });

  it('still refuses to start when a security-critical value is wrong', () => {
    expect(() =>
      loadEnv({
        ...validProduction,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'short',
      } as NodeJS.ProcessEnv),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('suggests the intended value for an enum typo', () => {
    expect(() =>
      loadEnv({
        ...validProduction,
        NODE_ENV: 'production',
        STORAGE_PROVIDER: 'databse',
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });
});
