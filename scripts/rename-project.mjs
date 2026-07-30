#!/usr/bin/env node
/**
 * Single-command rebrand.
 *
 *   pnpm rename-project "Nova Break" novabreak            # apply
 *   pnpm rename-project "Nova Break" novabreak --dry-run  # preview only
 *
 * Rewrites every tracked text file: workspace package names (@pulse/* ),
 * display names, slugs (database user, cookie prefix, storage keys, Capacitor
 * app id) and package.json names. Binary assets and generated folders are
 * skipped. Afterwards run: pnpm install && pnpm db:generate && pnpm build.
 */
import { execFileSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const [newName, requestedSlug] = args.filter((argument) => !argument.startsWith('--'));
const newSlug = requestedSlug?.toLowerCase();

if (!newName || !newSlug || !/^[a-z][a-z0-9-]{1,30}$/.test(newSlug)) {
  console.error('Usage: pnpm rename-project "New Name" new-slug [--dry-run] [--force]');
  console.error(
    'Slug must start with a letter and contain only lowercase letters, digits or hyphens.',
  );
  process.exit(2);
}

const root = resolve(import.meta.dirname, '..');

// A rebrand touches ~70 files; insist on a clean tree so it can be reviewed
// (and reverted) as a single commit.
if (!dryRun && !force) {
  try {
    const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
    if (status.trim()) {
      console.error('Working tree is not clean. Commit or stash first, or pass --force.');
      process.exit(3);
    }
  } catch {
    /* not a git checkout: continue */
  }
}

// Ignored by *path*, not by name: `infrastructure/backups` holds real scripts
// that must be renamed, while `apps/mobile/android` is generated output.
const ignoredNames = new Set(['.git', '.next', 'node_modules', 'dist', 'coverage', 'preview']);
const ignoredPaths = new Set([
  'apps/mobile/android',
  'apps/mobile/ios',
  'apps/mobile/www/js',
  'uploads',
]);

const textExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.yaml',
  '.yml',
  '.md',
  '.css',
  '.html',
  '.xml',
  '.txt',
  '.prisma',
  '.sql',
  '.sh',
  '.example',
  '.webmanifest',
  '.svg',
]);

// Extension-less or oddly-suffixed files that still contain the brand
// (Dockerfile.web references `pnpm --filter @pulse/web`, so missing these would
// break the image builds after a rename).
const textFilePrefixes = ['Dockerfile', 'Makefile', '.dockerignore', '.gitignore'];
const isTextFile = (name) =>
  textExtensions.has(extname(name)) ||
  name.startsWith('.env') ||
  textFilePrefixes.some((prefix) => name.startsWith(prefix));

const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignoredNames.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (ignoredPaths.has(relative(root, path))) continue;
    if (entry.isDirectory()) await walk(path);
    else if (isTextFile(entry.name)) files.push(path);
  }
}
await walk(root);

/** The one place that defines what a rebrand means. */
export const applyRename = (text, { name, slug }) =>
  text
    .replaceAll('@pulse/', `@${slug}/`)
    .replaceAll('PULSE', name.toUpperCase())
    .replaceAll('Pulse', name)
    .replaceAll('pulse', slug);

const changedFiles = [];
for (const file of files) {
  const before = await readFile(file, 'utf8');
  const after = applyRename(before, { name: newName, slug: newSlug });
  if (after === before) continue;
  changedFiles.push(relative(root, file));
  if (!dryRun) await writeFile(file, after);
}

if (!dryRun) {
  for (const file of files.filter((entry) => entry.endsWith('package.json'))) {
    const manifest = JSON.parse(await readFile(file, 'utf8'));
    if (manifest.name === 'pulse') {
      manifest.name = newSlug;
      await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`);
    }
  }
}

const grouped = new Map();
for (const file of changedFiles) {
  const top = file.includes('/') ? `${file.split('/')[0]}/` : file;
  grouped.set(top, (grouped.get(top) ?? 0) + 1);
}

console.log(`${dryRun ? '[dry-run] Would rewrite' : 'Rewrote'} ${changedFiles.length} files:`);
for (const [group, count] of [...grouped].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${group.padEnd(24)} ${count}`);
}

if (dryRun) {
  console.log('\nNo files were modified. Re-run without --dry-run to apply.');
} else {
  console.log(`\nNext steps:
  1. pnpm install                      # workspace links pick up @${newSlug}/*
  2. pnpm db:generate                  # needs access to binaries.prisma.sh
  3. pnpm build && pnpm test
  4. Update .env (APP_NAME, APP_SLUG, MOBILE_APP_ID, DATABASE_URL)
  5. apps/mobile: npx cap add android && npx cap add ios (native ids change)`);
}
