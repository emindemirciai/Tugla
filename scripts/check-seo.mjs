#!/usr/bin/env node
/**
 * Crawlability check.
 *
 * Search Console reports arrive weeks after the mistake and describe symptoms,
 * not causes. These are the contradictions a site can check about itself in a
 * second: a sitemap that lists a URL which 404s, a sitemap that lists a URL its
 * own robots.txt forbids, or a page whose canonical points somewhere else — all
 * of which quietly keep pages out of the index.
 *
 *   SITE_URL=https://tugla.fun pnpm check:seo
 */
const site = (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const get = async (url) => {
  const response = await fetch(url, { redirect: 'manual' });
  return { status: response.status, body: await response.text(), headers: response.headers };
};

console.log(`\nSite: ${site}\n`);

const robots = await get(`${site}/robots.txt`);
if (/not in allowlist|egress/i.test(robots.body)) {
  console.log('  ! this network cannot reach the site; run the check from somewhere that can\n');
  process.exit(2);
}
check('robots.txt responds', robots.status === 200, `status ${robots.status}`);
check('robots.txt points at a sitemap', /Sitemap:/i.test(robots.body));

const disallowed = [...robots.body.matchAll(/^Disallow:\s*(\S+)/gim)].map((match) => match[1]);

const sitemap = await get(`${site}/sitemap.xml`);
check('sitemap responds', sitemap.status === 200, `status ${sitemap.status}`);

const urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
check('sitemap lists at least one URL', urls.length > 0, `${urls.length} URLs`);

for (const url of urls) {
  const path = new URL(url).pathname;

  // A sitemap says "please index this"; robots.txt says "do not read this".
  // Shipping both is a contradiction the crawler resolves by dropping the page.
  const blocked = disallowed.some((rule) => rule !== '/' && path.startsWith(rule));
  check(`${path} is not blocked by robots.txt`, !blocked);

  const page = await get(url.replace(/^https?:\/\/[^/]+/, site));
  check(`${path} responds`, page.status === 200, `status ${page.status}`);

  if (page.status === 200) {
    const canonical = /rel="canonical"\s+href="([^"]+)"/.exec(page.body)?.[1];
    check(
      `${path} declares itself canonical`,
      canonical === undefined || new URL(canonical).pathname === path,
      canonical ? `points at ${new URL(canonical).pathname}` : 'no canonical',
    );
  }
}

console.log(`\n${failures ? `${failures} problem(s)` : 'No crawlability problems found'}\n`);
process.exit(failures ? 1 : 0);
