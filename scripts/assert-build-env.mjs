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
