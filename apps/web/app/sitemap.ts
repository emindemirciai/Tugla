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
    // No hreflang alternates.
    //
    // Language here is a client preference, not a URL: `?lang=tr` and `?lang=en`
    // serve byte-identical HTML. Declaring them as alternates asked Google to
    // crawl two extra copies of every page, each of which then correctly
    // reported "alternate page with proper canonical tag" — noise this sitemap
    // was manufacturing about itself. Honest hreflang needs per-language URLs
    // that actually differ.
  }));
}
