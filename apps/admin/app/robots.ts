import type { MetadataRoute } from 'next';

/** The control centre is staff-only: no crawler, classic or generative. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] };
}
