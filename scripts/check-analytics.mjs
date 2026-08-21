#!/usr/bin/env node
/**
 * Analytics wiring check.
 *
 * Three things have to line up before a single visit is recorded, and each has
 * failed at least once here: the game page must actually carry the tracker
 * script, the dashboard must serve it, and the dashboard must accept events
 * from this origin. Checking them separately turns "no data" from a mystery
 * into a named cause.
 *
 *   pnpm check:analytics                       # uses NEXT_PUBLIC_ANALYZE_URL
 *   SITE_URL=https://tugla.fun ANALYZE_URL=https://analiz.tugla.fun pnpm check:analytics
 */
const site = (process.env.SITE_URL ?? process.env.WEB_URL ?? 'https://tugla.fun').replace(
  /\/+$/,
  '',
);
const dashboard = (
  process.env.ANALYZE_URL ??
  process.env.NEXT_PUBLIC_ANALYZE_URL ??
  'https://analiz.tugla.fun'
).replace(/\/+$/, '');

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const fetchText = async (url, options) => {
  const response = await fetch(url, { redirect: 'follow', ...options });
  const body = await response.text();
  // A restricted network answers 403 with its own message. Reporting that as
  // "the site is broken" would be a false accusation, so it is called out.
  const blocked = /not in allowlist|egress/i.test(body);
  return { status: response.status, headers: response.headers, body, blocked };
};

console.log(`\nSite: ${site}\nDashboard: ${dashboard}\n`);

try {
  const page = await fetchText(site);
  if (page.blocked) {
    console.log('  ! this network cannot reach the site; run the check from somewhere that can\n');
    process.exit(2);
  }
  record('the site responds', page.status === 200, `status ${page.status}`);
  const hasTracker = page.body.includes(`${dashboard}/api/tracker`);
  record(
    'the page includes the tracker script',
    hasTracker,
    hasTracker ? '' : 'NEXT_PUBLIC_ANALYZE_URL is probably missing from the web build',
  );
} catch (error) {
  record('the site responds', false, String(error).slice(0, 90));
}

try {
  const tracker = await fetchText(`${dashboard}/api/tracker`);
  record('the dashboard serves the tracker', tracker.status === 200, `status ${tracker.status}`);
  record(
    'the tracker is JavaScript',
    (tracker.headers.get('content-type') ?? '').includes('javascript'),
    tracker.headers.get('content-type') ?? 'no content-type',
  );
} catch (error) {
  record('the dashboard serves the tracker', false, String(error).slice(0, 90));
}

try {
  // A real event from this origin: if ANALYZE_ALLOWED_ORIGIN is wrong, this is
  // where it shows up rather than in an empty dashboard a week later.
  const probe = await fetchText(`${dashboard}/api/track`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: site, referer: `${site}/` },
    body: JSON.stringify({
      type: 'pageview',
      url: `${site}/`,
      referrer: '',
      site: new URL(site).host,
    }),
  });
  record(
    'the dashboard accepts an event from this origin',
    probe.status < 400,
    `status ${probe.status}${probe.status === 403 ? ' — check ANALYZE_ALLOWED_ORIGIN' : ''}`,
  );
} catch (error) {
  record('the dashboard accepts an event from this origin', false, String(error).slice(0, 90));
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed\n`);
process.exit(failed.length ? 1 : 0);
