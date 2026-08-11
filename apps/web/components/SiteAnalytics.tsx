'use client';

import Script from 'next/script';

/**
 * Site analytics — Analyze Your Site (Siteni Analiz Et), self-hosted.
 *
 * Renders nothing until `NEXT_PUBLIC_ANALYZE_URL` points at a deployment, so a
 * fresh checkout never phones home and the feature is honestly "off" rather
 * than silently broken. The tracker derives its ingest endpoint from its own
 * script URL, so only the base URL and the site key are needed here.
 *
 * The older `NEXT_PUBLIC_ANALYTICS_*` names are still read: renaming a variable
 * should not switch tracking off on a deployment that has not been edited yet.
 */
export function SiteAnalytics() {
  const base = (
    process.env.NEXT_PUBLIC_ANALYZE_URL ?? process.env.NEXT_PUBLIC_ANALYTICS_URL
  )?.trim();
  if (!base) return null;

  const site =
    (process.env.NEXT_PUBLIC_ANALYZE_SITE ?? process.env.NEXT_PUBLIC_ANALYTICS_SITE)?.trim() ||
    undefined;
  return (
    <Script
      src={`${base.replace(/\/+$/, '')}/api/tracker`}
      data-site={site}
      strategy="afterInteractive"
    />
  );
}
