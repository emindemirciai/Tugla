#!/usr/bin/env node
/**
 * Verifies that every repository path a workspace build script needs is copied
 * into the corresponding Docker build stage.
 *
 * A Dockerfile that forgets `COPY scripts scripts` builds fine locally and fails
 * only on the deployment host with a confusing "Cannot find module" — this check
 * turns that into a red CI step instead.
 */
import { existsSync, readFileSync } from 'node:fs';
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
  // Directories a stage creates for itself. Variables are resolved with the ENV
  // values in force at that line: the same name is often reset in a later stage,
  // so resolving against the whole file would pick the wrong value.
  const environment = new Map();
  const created = [];
  for (const line of dockerfile.split('\n')) {
    const assignment = /^ENV\s+(\w+)=([^\s\\]+)/.exec(line);
    if (assignment) environment.set(assignment[1], assignment[2]);
    const mkdir = /mkdir\s+-p\s+"?([^\s&|"]+)"?/.exec(line);
    if (!mkdir) continue;
    const target = mkdir[1];
    created.push(
      target.startsWith('$')
        ? (environment.get(target.replace(/^\$\{?|\}$/g, '')) ?? target)
        : target,
    );
  }

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

/**
 * Build args must be declared where they are used.
 *
 * `--build-arg FOO=x` against a Dockerfile with no `ARG FOO` is not an error:
 * Docker drops the value. Every public Next.js variable is baked at build time,
 * so a dropped arg means the feature it configures is simply missing from the
 * image — which is exactly how the analytics tracker disappeared from the page
 * after a rename touched compose but not the Dockerfile.
 */
const checkComposeBuildArgs = () => {
  const composePath = join(root, 'infrastructure/dokploy/compose.production.yml');
  if (!existsSync(composePath)) return;

  const lines = readFileSync(composePath, 'utf8').split('\n');
  let dockerfile = null;
  let inArgs = false;
  let inspected = 0;

  for (const line of lines) {
    const file = /^\s*dockerfile:\s*(\S+)/.exec(line);
    if (file) {
      dockerfile = file[1];
      inArgs = false;
      continue;
    }
    if (/^\s*args:\s*$/.test(line)) {
      inArgs = true;
      continue;
    }
    if (inArgs && /^\s{0,6}\w[\w.-]*:/.test(line)) inArgs = false;

    const arg = inArgs ? /^\s+([A-Z][A-Z0-9_]*):/.exec(line) : null;
    if (!arg || !dockerfile) continue;

    const dockerfilePath = join(root, dockerfile);
    if (!existsSync(dockerfilePath)) continue;

    inspected += 1;
    const declared = new Set(
      [...readFileSync(dockerfilePath, 'utf8').matchAll(/^ARG\s+(\w+)/gm)].map((match) => match[1]),
    );
    if (!declared.has(arg[1])) {
      failures.push(
        `${dockerfile}: compose passes build arg "${arg[1]}" but the Dockerfile never declares it, so Docker drops the value`,
      );
    }
  }

  // A check that inspected nothing is not a passing check.
  if (!inspected) {
    failures.push('compose build args could not be read; this check verified nothing');
  }
};

/**
 * Build contexts must resolve from the project directory.
 *
 * Compose v2 resolves relative paths against `--project-directory`, not against
 * the compose file's own folder. Dokploy runs the file with the repo root as the
 * project directory, so a `context: ../..` climbed two levels ABOVE the repo and
 * Docker went looking for the Dockerfile in `/etc/dokploy/compose/infrastructure`
 * — a path that does not exist. The deploy failed before a single image built,
 * with an error that named a directory nobody had ever written down.
 *
 * Resolving the same way here turns that into a red check instead.
 */
const checkComposeContexts = () => {
  const composePath = join(root, 'infrastructure/dokploy/compose.production.yml');
  if (!existsSync(composePath)) return;

  const lines = readFileSync(composePath, 'utf8').split('\n');
  let context = null;
  let checked = 0;

  for (const line of lines) {
    const ctx = /^\s*context:\s*(\S+)/.exec(line);
    if (ctx) {
      context = ctx[1];
      continue;
    }
    const dockerfile = /^\s*dockerfile:\s*(\S+)/.exec(line);
    if (!dockerfile || !context) continue;

    // The project directory IS the repo root when Dokploy invokes compose.
    const resolved = resolve(root, context, dockerfile[1]);
    checked += 1;
    if (!existsSync(resolved)) {
      failures.push(
        `compose: context "${context}" + dockerfile "${dockerfile[1]}" resolves to ${resolved}, which does not exist from the project directory`,
      );
    }
    context = null;
  }

  if (!checked) {
    failures.push('compose build contexts could not be read; this check verified nothing');
  }
};

checkComposeContexts();

checkComposeBuildArgs();

if (failures.length) {
  console.error(
    'Docker build context problems:\n' + failures.map((line) => `  - ${line}`).join('\n'),
  );
  process.exit(1);
}
console.log(`Docker build context OK (${targets.length + 1} Dockerfiles checked).`);
