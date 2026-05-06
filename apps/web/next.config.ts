import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

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

// Sentry: minimal — errors + stack traces + source-map upload. No tracing,
// no replay, no profiling. Source-map upload only fires when
// SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT are set in CI/Vercel;
// without them the build still succeeds but stack traces remain minified.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: true,
  disableLogger: true,
});
