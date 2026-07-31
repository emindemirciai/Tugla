import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  transpilePackages: ['@tugla/game-engine', '@tugla/shared'],
};

export default config;
