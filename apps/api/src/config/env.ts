import { z } from 'zod';

/**
 * Environment contract for the API.
 *
 * Secrets are never defaulted in production: if a required secret is missing
 * the process refuses to boot rather than silently running with a known key.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  // Request throttling is per client IP. Mobile carriers put many players
  // behind one address, so the defaults are generous enough for shared NAT
  // while still stopping a single abusive client.
  RATE_LIMIT_BURST: z.coerce.number().int().min(1).max(100000).default(30),
  RATE_LIMIT_BURST_SECONDS: z.coerce.number().int().min(1).max(3600).default(1),
  RATE_LIMIT_SUSTAINED: z.coerce.number().int().min(1).max(1000000).default(1200),
  RATE_LIMIT_SUSTAINED_SECONDS: z.coerce.number().int().min(1).max(86400).default(60),
  // Multiplies the auth-specific limits (registrations, login attempts, reset
  // requests). Must stay 1 in production; it exists so automated suites can
  // exercise the flows repeatedly from one address without weakening the
  // shipped defaults.
  // Refresh generated content after the service starts. Kept inside the API so
  // a seeding problem can never fail a deployment or block the site.
  SEED_ON_DEPLOY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  AUTH_RATE_LIMIT_FACTOR: z.coerce.number().int().min(1).max(10000).default(1),

  APP_NAME: z.string().min(1).default('Tuğla'),
  APP_SLUG: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/)
    .default('tugla'),
  ROOT_DOMAIN: z.string().min(1).default('localhost'),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_URL: z.string().url().default('http://localhost:3001'),
  API_URL: z.string().url().default('http://localhost:4000'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  SESSION_ENCRYPTION_KEY: z.string().min(32),
  INTERNAL_API_KEY: z.string().min(16).optional(),

  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(365).default(30),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),

  MAIL_PROVIDER: z.enum(['smtp', 'log', 'disabled']).default('log'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('Tuğla <no-reply@localhost>'),

  STORAGE_PROVIDER: z.enum(['s3', 'database']).default('database'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('true')
    .transform((value) => value === 'true'),

  ADS_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  PAYMENTS_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(10).optional(),

  SENTRY_DSN: z.string().optional(),
  REPLAY_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
});

export type AppEnv = z.infer<typeof schema>;

const developmentFallbacks: Record<string, string> = {
  DATABASE_URL: 'postgresql://tugla:tugla@localhost:5432/tugla?schema=public',
  JWT_ACCESS_SECRET: 'development-access-secret-development-access-secret',
  JWT_REFRESH_SECRET: 'development-refresh-secret-development-refresh-secret',
  SESSION_ENCRYPTION_KEY: 'development-session-secret-development-session-key',
};

let cached: AppEnv | null = null;

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): AppEnv => {
  const isProduction = source.NODE_ENV === 'production';
  // A key present but blank (`FOO=` in .env) means "not configured", not "empty
  // string" — otherwise every optional secret fails its min-length rule.
  const merged: NodeJS.ProcessEnv = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ''),
  );
  if (!isProduction) {
    for (const [key, value] of Object.entries(developmentFallbacks)) {
      if (!merged[key]) merged[key] = value;
    }
  }
  const parsed = schema.safeParse(merged);
  if (parsed.success) return parsed.data;

  // Not every misconfiguration deserves a dead service.
  //
  // A typo in an optional integration (`MAIL_PROVIDER=stmp`) once took the whole
  // site down: the API refused to boot, so web and admin had nothing to depend
  // on. Settings that only disable a feature now fall back to their safe default
  // with a loud warning, while anything that would make the service unsafe or
  // unable to serve — database URL, token secrets — stays fatal.
  const recoverable = new Set([
    'MAIL_PROVIDER',
    'STORAGE_PROVIDER',
    'DEFAULT_LOCALE',
    'SEO_INDEXABLE',
    'SEED_ON_DEPLOY',
    'AI_CRAWLERS_ALLOWED',
  ]);

  const fatal = parsed.error.issues.filter((issue) => !recoverable.has(String(issue.path[0])));
  const ignored = parsed.error.issues.filter((issue) => recoverable.has(String(issue.path[0])));

  if (fatal.length) {
    const details = fatal
      .map((issue) => `  - ${issue.path.join('.')}: ${describe(issue)}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  const retry: NodeJS.ProcessEnv = { ...merged };
  for (const issue of ignored) {
    const key = String(issue.path[0]);
    console.warn(
      `[env] ${key}: ${describe(issue)} — falling back to the default. ` +
        'The service starts, but this setting is not active.',
    );
    delete retry[key];
  }

  const second = schema.safeParse(retry);
  if (second.success) return second.data;

  const details = second.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${describe(issue)}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
};

/** Adds a "did you mean" hint to enum mistakes, which are almost always typos. */
const describe = (issue: z.ZodIssue): string => {
  if (issue.code !== 'invalid_enum_value') return issue.message;
  const received = String(issue.received);
  const closest = issue.options
    .map((option) => ({ option: String(option), distance: editDistance(received, String(option)) }))
    .sort((a, b) => a.distance - b.distance)[0];
  return closest && closest.distance <= 2
    ? `${issue.message} — did you mean '${closest.option}'?`
    : issue.message;
};

/** Levenshtein distance, small enough to keep inline. */
const editDistance = (a: string, b: string): number => {
  const rows = Array.from({ length: a.length + 1 }, (_, index) => [
    index,
    ...Array<number>(b.length).fill(0),
  ]);
  for (let column = 0; column <= b.length; column += 1) rows[0]![column] = column;
  for (let row = 1; row <= a.length; row += 1) {
    for (let column = 1; column <= b.length; column += 1) {
      rows[row]![column] = Math.min(
        rows[row - 1]![column]! + 1,
        rows[row]![column - 1]! + 1,
        rows[row - 1]![column - 1]! + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
    }
  }
  return rows[a.length]![b.length]!;
};

export const env = (): AppEnv => (cached ??= loadEnv());

/** Test helper: clears the memoised environment. */
export const resetEnvCache = () => {
  cached = null;
};

export interface ProviderStatus {
  googleAuth: boolean;
  appleAuth: boolean;
  mail: boolean;
  objectStorage: boolean;
  ads: boolean;
  payments: boolean;
}

/**
 * Which externally-provisioned integrations are actually configured.
 * The UI uses this to hide, not fake, features whose accounts do not exist yet.
 */
export const providerStatus = (config: AppEnv = env()): ProviderStatus => ({
  googleAuth: Boolean(config.GOOGLE_CLIENT_ID),
  appleAuth: Boolean(config.APPLE_CLIENT_ID),
  mail:
    config.MAIL_PROVIDER === 'smtp' ? Boolean(config.SMTP_HOST) : config.MAIL_PROVIDER === 'log',
  objectStorage:
    config.STORAGE_PROVIDER === 's3'
      ? Boolean(config.S3_BUCKET && config.S3_ACCESS_KEY && config.S3_SECRET_KEY)
      : true,
  ads: config.ADS_ENABLED,
  payments: config.PAYMENTS_ENABLED && Boolean(config.STRIPE_SECRET_KEY),
});
