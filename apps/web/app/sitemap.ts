import type { MetadataRoute } from 'next';
import { absolute, PUBLIC_ROUTES, seoConfig } from '../lib/seo';

/** Public routes only, each with both language variants declared. */
// Evaluated per request so the deployed WEB_URL/APP_NAME are always used,
// even when the image was built without them.
export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  const config = seoConfig();
  const lastModified = new Date();
  return PUBLIC_ROUTES.map((route) => ({
    url: absolute(config, route),
    lastModified,
    changeFrequency: route === '/' ? ('weekly' as const) : ('monthly' as const),
    priority: route === '/' ? 1 : 0.6,
    alternates: {
      languages: {
        tr: `${absolute(config, route)}?lang=tr`,
        en: `${absolute(config, route)}?lang=en`,
      },
    },
  }));
}
