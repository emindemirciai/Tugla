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

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: appVersion },
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  transpilePackages: ['@tugla/game-engine', '@tugla/shared'],
  experimental: {
    optimizePackageImports: ['three'],
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        // Google Identity Services opens a popup and talks back to this
        // window. Under a strict `same-origin` policy that channel is severed
        // and the popup either hangs or closes with no result, so sign-in fails
        // silently. `same-origin-allow-popups` keeps cross-origin isolation for
        // everything else while permitting exactly that handshake.
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
      ],
    },
  ],
};

export default nextConfig;
