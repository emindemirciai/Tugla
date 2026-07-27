import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  transpilePackages: ['@pulse/game-engine', '@pulse/shared'],
  experimental: { workerThreads: true, cpus: 1 },
};

export default config;
