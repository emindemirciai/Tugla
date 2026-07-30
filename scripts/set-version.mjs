#!/usr/bin/env node
/**
 * Bumps the single product version.
 *
 *   pnpm release:version 1.5.0
 *
 * The root package.json is the source of truth; apps read it through
 * NEXT_PUBLIC_APP_VERSION / npm_package_version and the API reports it on
 * /api/health. Commit messages reference the same number (· v1.5).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import process from 'node:process';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: pnpm release:version <major.minor.patch>');
  process.exit(2);
}

const root = resolve(import.meta.dirname, '..');
const manifests = [
  'package.json',
  'apps/api/package.json',
  'apps/web/package.json',
  'apps/admin/package.json',
  'apps/mobile/package.json',
  'packages/shared/package.json',
  'packages/game-engine/package.json',
  'packages/database/package.json',
];

for (const relative of manifests) {
  const path = join(root, relative);
  try {
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    manifest.version = version;
    await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`  ${relative} -> ${version}`);
  } catch (error) {
    console.error(`  skipped ${relative}: ${error.message}`);
  }
}

const short = version.split('.').slice(0, 2).join('.');
console.log(`\nSuggested commit suffix: · v${short}`);
