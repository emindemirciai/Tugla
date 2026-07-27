import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  transpilePackages: ['@tugla/game-engine', '@tugla/shared'],
  experimental: { workerThreads: true, cpus: 1 },
};

export default config;
