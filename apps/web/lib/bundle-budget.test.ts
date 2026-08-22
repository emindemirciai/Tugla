import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Route weight budget.
 *
 * The hub is a list of levels; it once shipped the whole 3D renderer with it,
 * which on a phone is the difference between an instant screen and a wait. The
 * fix is easy to undo by accident — one static import brings three.js straight
 * back — so the budget is asserted from the build manifest rather than trusted.
 *
 * The test is skipped when there is no build output, because a unit test suite
 * should not require a production build to run.
 */
const manifestPath = 'apps/web/.next/app-build-manifest.json';
const resolved = existsSync(manifestPath) ? manifestPath : `../../${manifestPath}`;

describe('route weight', () => {
  it.skipIf(!existsSync(resolved))('keeps the renderer out of the hub bundle', () => {
    const manifest = JSON.parse(readFileSync(resolved, 'utf8')) as {
      pages: Record<string, string[]>;
    };

    for (const route of ['/play/page', '/create/page']) {
      const chunks = manifest.pages[route] ?? [];
      expect(chunks.length, `${route} has no chunks in the manifest`).toBeGreaterThan(0);

      // three.js is large enough that its chunk dwarfs everything else on these
      // routes; the eager import shows up as a jump in the entry chunk count.
      // Manifest paths are relative to .next; leaving that out made every file
      // "not found", the total zero, and the assertion pass without measuring
      // anything — the exact failure this test exists to prevent.
      const root = resolved.replace('app-build-manifest.json', '');
      const totalBytes = chunks
        .filter((chunk) => chunk.endsWith('.js') && existsSync(`${root}${chunk}`))
        .reduce((sum, chunk) => sum + readFileSync(`${root}${chunk}`).byteLength, 0);

      expect(
        totalBytes,
        `${route} measured 0 bytes, so this check verified nothing`,
      ).toBeGreaterThan(10_000);

      // 700 kB of raw (uncompressed) entry JavaScript is roughly twice what the
      // hub needs and well below what an eager three.js import produces.
      expect(totalBytes, `${route} entry JavaScript grew past its budget`).toBeLessThan(700_000);
    }
  });
});
