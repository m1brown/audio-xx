/**
 * Server-side Sentry config. Loaded in Vercel functions / Node runtime.
 *
 * Minimal setup matching the client config — errors + stack traces only.
 * DSN read from SENTRY_DSN (server-only env var).
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  tracesSampleRate: 0,
});
