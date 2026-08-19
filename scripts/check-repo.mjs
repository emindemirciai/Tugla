#!/usr/bin/env node
/**
 * Repository hygiene check.
 *
 * Everything here has bitten this project at least once: a version that drifted
 * between packages, a stray debug file left in a delivery, a secret pasted into
 * a tracked file, a migration folder without SQL. Each is cheap to check and
 * expensive to discover after a deploy, so they run with the rest of the gate.
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const problems = [];
const note = (message) => problems.push(message);

const run = (command) => execSync(command, { encoding: 'utf8' }).trim();

// 1. Every workspace package reports the same version.
const rootVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
const manifests = run("git ls-files '*package.json'")
  .split('\n')
  .filter((path) => path && !path.includes('node_modules'));
for (const manifest of manifests) {
  const parsed = JSON.parse(readFileSync(manifest, 'utf8'));
  if (parsed.version && parsed.version !== rootVersion) {
    note(`${manifest}: version ${parsed.version} differs from the root ${rootVersion}`);
  }
}

// 2. No leftover scratch files in the tracked tree.
const junk = run('git ls-files')
  .split('\n')
  .filter((path) =>
    /(^|\/)(tmp|temp|scratch|debug)[^/]*$|\.(log|orig|rej|bak)$|\.DS_Store$/i.test(path),
  );
if (junk.length) note(`tracked scratch files: ${junk.join(', ')}`);

// 3. Nothing that looks like a real secret is committed.
const secretPattern =
  /(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[baprs]-[0-9A-Za-z-]{10,}|ghp_[0-9A-Za-z]{30,})/;
for (const file of run(
  "git ls-files '*.ts' '*.tsx' '*.mjs' '*.js' '*.yml' '*.yaml' '*.json' '*.md'",
).split('\n')) {
  if (!file || file.includes('pnpm-lock')) continue;
  const contents = readFileSync(file, 'utf8');
  if (secretPattern.test(contents)) note(`${file}: looks like it contains a credential`);
}

// 4. Every migration directory actually carries SQL.
const migrationsDir = 'packages/database/prisma/migrations';
if (existsSync(migrationsDir)) {
  for (const entry of readdirSync(migrationsDir)) {
    if (entry === 'migration_lock.toml') continue;
    if (!existsSync(join(migrationsDir, entry, 'migration.sql'))) {
      note(`${entry}: migration folder without migration.sql`);
    }
  }
}

// 5. The working tree is clean, so what was verified is what ships.
const status = run('git status --porcelain');
if (status) note(`working tree is dirty:\n${status}`);

if (problems.length) {
  console.error('Repository check failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`Repository OK (version ${rootVersion}, ${manifests.length} manifests checked).`);
