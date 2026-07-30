import { describe, expect, it } from 'vitest';
import {
  AI_CRAWLERS,
  absolute,
  faq,
  llmsTxt,
  localizedDescription,
  PRIVATE_ROUTES,
  PUBLIC_ROUTES,
  robotsRules,
  seoConfig,
} from './seo';

const base = {
  APP_NAME: 'Pulse',
  APP_TAGLINE: 'Break the grid',
  WEB_URL: 'https://play.example.com/',
  NODE_ENV: 'production',
} as NodeJS.ProcessEnv;

describe('seo configuration', () => {
  it('normalises the site URL and derives absolute links', () => {
    const config = seoConfig(base);
    expect(config.webUrl).toBe('https://play.example.com');
    expect(absolute(config, '/sitemap.xml')).toBe('https://play.example.com/sitemap.xml');
  });

  it('keeps non-production environments out of the index', () => {
    expect(seoConfig({ ...base, NODE_ENV: 'development' }).indexable).toBe(false);
    expect(seoConfig({ ...base, NODE_ENV: 'development', SEO_INDEXABLE: 'true' }).indexable).toBe(
      true,
    );
  });

  it('blocks everything when the site is not indexable', () => {
    const rules = robotsRules(seoConfig({ ...base, NODE_ENV: 'development' }));
    expect(rules).toEqual([{ userAgent: '*', disallow: '/' }]);
  });

  it('never exposes player screens to crawlers', () => {
    const rules = robotsRules(seoConfig(base));
    for (const rule of rules) {
      expect(rule.disallow).toContain('/account');
      expect(rule.disallow).toContain('/play');
    }
  });

  it('answers AI crawlers explicitly and can shut them out', () => {
    const allowed = robotsRules(seoConfig(base)).find((rule) => Array.isArray(rule.userAgent));
    expect(allowed?.userAgent).toEqual([...AI_CRAWLERS]);
    expect(allowed?.allow).toBe('/');

    const blocked = robotsRules(seoConfig({ ...base, AI_CRAWLERS_ALLOWED: 'false' })).find((rule) =>
      Array.isArray(rule.userAgent),
    );
    expect(blocked?.disallow).toBe('/');
  });

  it('has no overlap between public and private routes', () => {
    const overlap = PUBLIC_ROUTES.filter((route) =>
      (PRIVATE_ROUTES as readonly string[]).includes(route),
    );
    expect(overlap).toEqual([]);
  });
});

describe('llms.txt', () => {
  it('is written in the requested language and links absolute URLs', () => {
    const config = seoConfig(base);
    const tr = llmsTxt(config, 'tr');
    const en = llmsTxt(config, 'en');
    expect(tr.startsWith('# Pulse')).toBe(true);
    expect(tr).toContain(localizedDescription.tr);
    expect(en).toContain('https://play.example.com/auth/register');
    expect(tr).not.toContain('undefined');
  });

  it('carries every FAQ entry so answer engines quote real copy', () => {
    const text = llmsTxt(seoConfig(base), 'en');
    for (const entry of faq.en) {
      expect(text).toContain(entry.question);
      expect(text).toContain(entry.answer);
    }
  });

  it('states the crawler policy honestly when AI access is disabled', () => {
    const text = llmsTxt(seoConfig({ ...base, AI_CRAWLERS_ALLOWED: 'false' }), 'en');
    expect(text).toContain('AI crawlers are disabled');
  });
});

describe('faq parity', () => {
  it('asks the same questions in both languages', () => {
    expect(faq.tr).toHaveLength(faq.en.length);
  });
});
