#!/usr/bin/env node
/**
 * Guards the Next.js builds.
 *
 * Building with NODE_ENV=development makes Next fall back to the pages-router
 * error document and the export of /404 fails with a confusing
 * "<Html> should not be imported outside of pages/_document". That cost a red
 * CI run once; this check turns it into a one-line, actionable failure.
 */
import process from 'node:process';

const value = process.env.NODE_ENV;
if (value && value !== 'production') {
  console.error(
    `\nRefusing to build with NODE_ENV="${value}".\n` +
      'Next.js sets NODE_ENV=production for a build; a different value breaks the /404 export.\n' +
      'Unset it (recommended) or set NODE_ENV=production for build steps only.\n',
  );
  process.exit(1);
}

/**
 * The site URL must be a real absolute URL with a host.
 *
 * The compose file builds it as `https://${ROOT_DOMAIN}`, so an unset
 * ROOT_DOMAIN produces the string "https://" — which is not a URL. Next.js then
 * fails while collecting page data with:
 *
 *   [Error: Failed to collect configuration for /_not-found]
 *   TypeError: Invalid URL ... input: 'https:'
 *
 * That message names neither the variable nor the file, and the deploy dies
 * after four minutes of image building. Checking it here costs nothing and says
 * exactly which variable is missing.
 */
const urlVars = ['WEB_URL', 'NEXT_PUBLIC_API_URL', 'API_URL'];
for (const name of urlVars) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') continue;

  let host = '';
  try {
    host = new URL(raw).hostname;
  } catch {
    host = '';
  }

  if (!host) {
    console.error(
      `\n${name}="${raw}" is not a usable URL.\n` +
        'It needs a scheme AND a host, for example https://example.com.\n' +
        'In the deployment this is built as https://${ROOT_DOMAIN}: an unset\n' +
        'ROOT_DOMAIN leaves "https://", which Next.js reports far away from here\n' +
        'as "Invalid URL" while collecting page data.\n',
    );
    process.exit(1);
  }
}
