/**
 * Single source of truth for brand/domain values.
 * Everything is environment-driven so the project can be renamed and re-domained
 * without touching application code.
 */
export interface BrandConfig {
  name: string;
  slug: string;
  tagline: string;
  rootDomain: string;
  webUrl: string;
  adminUrl: string;
  apiUrl: string;
  supportEmail: string;
  themeColor: string;
  backgroundColor: string;
}

const fallback = {
  name: 'Pulse',
  slug: 'pulse',
  rootDomain: 'localhost',
  themeColor: '#07111f',
  backgroundColor: '#07111f',
} as const;

/**
 * Reads brand configuration from the environment.
 * Accepts a record so both server (`process.env`) and bundled client
 * (`NEXT_PUBLIC_*` inlined at build time) can supply values.
 */
export const readBrand = (env: Record<string, string | undefined> = {}): BrandConfig => {
  const name = env.APP_NAME ?? env.NEXT_PUBLIC_APP_NAME ?? fallback.name;
  const slug = (env.APP_SLUG ?? env.NEXT_PUBLIC_APP_SLUG ?? fallback.slug).toLowerCase();
  const rootDomain = env.ROOT_DOMAIN ?? env.NEXT_PUBLIC_ROOT_DOMAIN ?? fallback.rootDomain;
  const webUrl = env.WEB_URL ?? env.NEXT_PUBLIC_WEB_URL ?? `http://${rootDomain}:3000`;
  const adminUrl = env.ADMIN_URL ?? `http://${rootDomain}:3001`;
  const apiUrl = env.NEXT_PUBLIC_API_URL ?? env.API_URL ?? `http://${rootDomain}:4000/api`;
  return {
    name,
    slug,
    tagline: env.APP_TAGLINE ?? env.NEXT_PUBLIC_APP_TAGLINE ?? 'Break the grid',
    rootDomain,
    webUrl,
    adminUrl,
    apiUrl,
    supportEmail: env.SUPPORT_EMAIL ?? `support@${rootDomain}`,
    themeColor: env.NEXT_PUBLIC_THEME_COLOR ?? fallback.themeColor,
    backgroundColor: env.NEXT_PUBLIC_BACKGROUND_COLOR ?? fallback.backgroundColor,
  };
};

/** Cookie names are namespaced by slug so multiple deployments can coexist. */
export const cookieNames = (slug: string) => ({
  refresh: `${slug}_refresh`,
  session: `${slug}_session`,
});
