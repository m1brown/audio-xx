import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

/**
 * Stage 8.2 — minimal HTTP security headers applied to every route.
 *
 * Three headers are sent on all responses, plus a fourth (HSTS) only
 * in production so local dev on http://localhost is unaffected (HSTS
 * on plain http forces the browser to upgrade subsequent requests
 * to https, which breaks `npm run dev`).
 *
 * Skipped intentionally for now:
 *   - Content-Security-Policy: strict CSP requires per-bundle nonce/
 *     hash plumbing that doesn't fit a beta polish pass. Tracked as
 *     POST-LAUNCH.
 *   - Permissions-Policy: no current feature needs scoping; defer
 *     until camera/mic/etc. are actually used.
 */
const SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
];

const nextConfig: NextConfig = {
  transpilePackages: ['@audio-xx/rules', '@audio-xx/data', '@audio-xx/signals'],
  typescript: {
    ignoreBuildErrors: true,
  },
  /* D1 mobile QA — M2 (2026-05-18).
   *
   * The Next.js dev-mode build-status indicator renders as a small dark
   * circle in the bottom-left of every page during `npm run dev`. In
   * the D1 mobile screenshot pass it overlapped the affiliate-disclosure
   * line in the page footer at 360–414w widths, where the disclosure
   * is legal copy that must remain readable.
   *
   * The indicator is NOT application chrome — it does not render in
   * production builds. Disabling it here is a dev-only cleanup that
   * removes a false-positive from QA screenshots while leaving the
   * production surface untouched. Production users never saw this
   * overlap. */
  devIndicators: false,
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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ];
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
});
