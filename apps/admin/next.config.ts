import { readFileSync } from 'node:fs';
import type { NextConfig } from 'next';
import path from 'node:path';

// Injected at build time from the workspace version, so the footer can never
// disagree with what is actually deployed.
// Read from the workspace manifest rather than npm_package_version: that
// variable depends on how the build was invoked and arrived empty, which put a
// bare "v" in the footer.
const appVersion = String(
  (
    JSON.parse(readFileSync(path.join(__dirname, '../../package.json'), 'utf8')) as {
      version?: string;
    }
  ).version ?? 'dev',
);

const config: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: appVersion },
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  poweredByHeader: false,
  transpilePackages: ['@tugla/game-engine', '@tugla/shared'],
};

export default config;
