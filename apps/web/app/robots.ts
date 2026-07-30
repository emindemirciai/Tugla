import type { MetadataRoute } from 'next';
import { absolute, robotsRules, seoConfig } from '../lib/seo';

/** Crawler policy, including an explicit answer to AI crawlers. */
// Evaluated per request so the deployed WEB_URL/APP_NAME are always used,
// even when the image was built without them.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const config = seoConfig();
  return {
    rules: robotsRules(config),
    sitemap: absolute(config, '/sitemap.xml'),
    host: config.webUrl,
  };
}
