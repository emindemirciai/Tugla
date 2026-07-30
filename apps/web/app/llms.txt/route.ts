import { llmsTxt, seoConfig } from '../../lib/seo';

/**
 * /llms.txt — a short, authoritative summary for AI answer engines.
 * `?lang=en` returns the English edition.
 */
export function GET(request: Request) {
  const config = seoConfig();
  const requested = new URL(request.url).searchParams.get('lang');
  const locale = requested === 'en' ? 'en' : requested === 'tr' ? 'tr' : config.defaultLocale;
  return new Response(llmsTxt(config, locale), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
