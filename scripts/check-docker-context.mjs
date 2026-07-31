#!/usr/bin/env node
/**
 * Verifies that every repository path a workspace build script needs is copied
 * into the corresponding Docker build stage.
 *
 * A Dockerfile that forgets `COPY scripts scripts` builds fine locally and fails
 * only on the deployment host with a confusing "Cannot find module" — this check
 * turns that into a red CI step instead.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '..');

/** Which Dockerfile builds which workspace app. */
const targets = [
  { dockerfile: 'infrastructure/docker/Dockerfile.web', app: 'apps/web' },
  { dockerfile: 'infrastructure/docker/Dockerfile.admin', app: 'apps/admin' },
  { dockerfile: 'infrastructure/docker/Dockerfile.api', app: 'apps/api' },
];

const failures = [];

for (const target of targets) {
  const dockerfile = await readFile(join(root, target.dockerfile), 'utf8');
  const manifest = JSON.parse(await readFile(join(root, target.app, 'package.json'), 'utf8'));
  const buildScript = manifest.scripts?.build ?? '';

  // Every `../../<dir>/...` reference in the build script must be copied.
  const referenced = [...buildScript.matchAll(/\.\.\/\.\.\/([\w.-]+)\//g)].map((match) => match[1]);
  const copied = [...dockerfile.matchAll(/^COPY\s+(?!--from)([^\s]+)\s+/gm)].map((match) =>
    match[1].replace(/^\.\//, '').replace(/\/$/, ''),
  );

  for (const directory of new Set(referenced)) {
    const isCopied = copied.some(
      (entry) => entry === directory || entry.startsWith(`${directory}/`),
    );
    if (!isCopied) {
      failures.push(
        `${target.dockerfile}: build script needs "${directory}/" but no COPY brings it into the image ` +
          `(add: COPY ${directory} ${directory})`,
      );
    }
  }
}

// The runtime stages copy Next.js standalone output; that needs the config flag.
for (const app of ['apps/web', 'apps/admin']) {
  const files = await readdir(join(root, app));
  const configFile = files.find((file) => file.startsWith('next.config.'));
  if (!configFile) continue;
  const config = await readFile(join(root, app, configFile), 'utf8');
  if (!config.includes("output: 'standalone'")) {
    failures.push(
      `${app}/${configFile}: missing output: 'standalone' — the Docker runtime stage copies .next/standalone`,
    );
  }
}

if (failures.length) {
  console.error(
    'Docker build context problems:\n' + failures.map((line) => `  - ${line}`).join('\n'),
  );
  process.exit(1);
}
console.log(`Docker build context OK (${targets.length} Dockerfiles checked).`);
