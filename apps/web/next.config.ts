import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@audio-xx/rules', '@audio-xx/data', '@audio-xx/signals'],
};

export default nextConfig;
