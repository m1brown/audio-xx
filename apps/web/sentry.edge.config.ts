/**
 * Edge-runtime Sentry config. Loaded in Vercel Edge functions and middleware.
 *
 * Minimal setup matching client/server configs — errors + stack traces only.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  tracesSampleRate: 0,
});
