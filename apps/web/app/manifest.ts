import type { MetadataRoute } from 'next';
import { localizedShortDescription, seoConfig } from '../lib/seo';

/**
 * Generated from the environment so a rename or rebrand needs no asset edits.
 * (Replaces the previous static public/manifest.webmanifest.)
 */
// Evaluated per request so the deployed WEB_URL/APP_NAME are always used,
// even when the image was built without them.
export const dynamic = 'force-dynamic';

export default function manifest(): MetadataRoute.Manifest {
  const config = seoConfig();
  return {
    name: `${config.appName} — ${config.tagline}`,
    short_name: config.appName,
    description: localizedShortDescription[config.defaultLocale],
    start_url: '/play?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#07111f',
    theme_color: '#07111f',
    lang: config.defaultLocale,
    dir: 'ltr',
    categories: ['games', 'entertainment'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: config.defaultLocale === 'tr' ? 'Oyna' : 'Play', url: '/play' },
      { name: config.defaultLocale === 'tr' ? 'İlerleme' : 'Progress', url: '/progress' },
      { name: config.defaultLocale === 'tr' ? 'Ligler' : 'Leagues', url: '/leagues' },
    ],
  };
}
