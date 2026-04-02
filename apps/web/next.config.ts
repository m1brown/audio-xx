import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@audio-xx/rules', '@audio-xx/data', '@audio-xx/signals'],
  typescript: {
    // TypeScript errors are checked separately via `npm run typecheck`.
    // SWC handles compilation for the build — tsc errors don't block deploy.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
