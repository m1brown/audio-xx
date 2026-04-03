import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@audio-xx/rules', '@audio-xx/data', '@audio-xx/signals'],
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: [
    '@prisma/client',
    '@libsql/client',
    '@prisma/adapter-libsql',
  ],
  webpack: (config) => {
    config.module.rules.push({
      test: /\.md$/,
      type: 'asset/source',
    });
    return config;
  },
};

export default nextConfig;
