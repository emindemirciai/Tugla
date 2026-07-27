import { readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import process from 'node:process';

const [, , newName, requestedSlug] = process.argv;
const newSlug = requestedSlug?.toLowerCase();

if (!newName || !newSlug || !/^[a-z][a-z0-9-]{1,30}$/.test(newSlug)) {
  console.error('Usage: pnpm rename-project "New Name" new-slug');
  console.error(
    'Slug must start with a letter and contain only lowercase letters, numbers or hyphens.',
  );
  process.exit(2);
}

const root = resolve(import.meta.dirname, '..');
const ignored = new Set([
  '.git',
  '.next',
  'node_modules',
  'dist',
  'coverage',
  'android',
  'ios',
  'backups',
  'uploads',
]);
const textExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.json',
  '.yaml',
  '.yml',
  '.md',
  '.css',
  '.html',
  '.xml',
  '.prisma',
  '.sql',
  '.sh',
  '.example',
  '.webmanifest',
]);

const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (textExtensions.has(extname(entry.name)) || entry.name.startsWith('.env'))
      files.push(path);
  }
}

await walk(root);
let changed = 0;
for (const file of files) {
  const before = await readFile(file, 'utf8');
  const after = before
    .replaceAll('@pulse/', `@${newSlug}/`)
    .replaceAll('PULSE', newName.toUpperCase())
    .replaceAll('Pulse', newName)
    .replaceAll('pulse', newSlug);
  if (after !== before) {
    await writeFile(file, after);
    changed += 1;
  }
}

const packageFiles = files.filter((file) => file.endsWith('package.json'));
for (const packageFile of packageFiles) {
  const packageJson = JSON.parse(await readFile(packageFile, 'utf8'));
  if (packageJson.name === 'pulse') {
    packageJson.name = newSlug;
    await writeFile(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);
  }
}

const existingEnv = join(root, '.env.example');
console.log(`Renamed ${changed} text files.`);
console.log(
  `Review ${relative(root, existingEnv)} and regenerate mobile native projects before release.`,
);
console.log('Run: pnpm install && pnpm typecheck && pnpm test && pnpm build');
