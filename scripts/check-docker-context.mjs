#!/usr/bin/env node
/**
 * Verifies that every repository path a workspace build script needs is copied
 * into the corresponding Docker build stage.
 *
 * A Dockerfile that forgets `COPY scripts scripts` builds fine locally and fails
 * only on the deployment host with a confusing "Cannot find module" — this check
 * turns that into a red CI step instead.
 */
import { existsSync } from 'node:fs';
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

// Every `COPY --from=<stage>` source must be guaranteed to exist, otherwise the
// image build dies with "not found" only on the deployment host. Repository
// paths are checked against the working tree; paths inside an externally cloned
// source tree must be created explicitly (RUN mkdir -p) or be a build artifact.
const BUILD_ARTIFACTS = ['.next', '/dist', 'node_modules'];

/** Files whose existence is already proven by a command the stage runs. */
const PROVEN_BY = [{ command: /npm ci/, files: ['package.json', 'package-lock.json'] }];

for (const target of targets.concat([
  { dockerfile: 'infrastructure/docker/Dockerfile.analytics' },
])) {
  const dockerfile = await readFile(join(root, target.dockerfile), 'utf8');
  const created = [...dockerfile.matchAll(/RUN\s+mkdir\s+-p\s+([^\s&|]+)/g)].map(
    (match) => match[1],
  );

  for (const match of dockerfile.matchAll(/^COPY\s+--from=\S+(?:\s+--chown=\S+)?\s+(.+)$/gm)) {
    const parts = match[1].trim().split(/\s+/);
    const sources = parts.slice(0, -1); // last token is the destination
    for (const source of sources) {
      if (BUILD_ARTIFACTS.some((artifact) => source.includes(artifact))) continue;
      if (created.some((path) => source === path || source.startsWith(`${path}/`))) continue;
      if (
        PROVEN_BY.some(
          (rule) =>
            rule.command.test(dockerfile) && rule.files.some((file) => source.endsWith(`/${file}`)),
        )
      )
        continue;

      if (source.startsWith('/repo/')) {
        const relative = source.slice('/repo/'.length);
        if (!existsSync(join(root, relative))) {
          failures.push(
            `${target.dockerfile}: COPY --from references "${source}" but "${relative}" does not exist in the repository`,
          );
        }
      } else if (!source.startsWith('/repo')) {
        // External source tree (e.g. a cloned upstream project): we cannot see
        // it, so it must be created explicitly in the build stage.
        failures.push(
          `${target.dockerfile}: COPY --from references "${source}" from an external source tree; ` +
            `add "RUN mkdir -p ${source}" in the build stage so the copy cannot fail`,
        );
      }
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
console.log(`Docker build context OK (${targets.length + 1} Dockerfiles checked).`);
