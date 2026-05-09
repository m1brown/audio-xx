/**
 * Client-side Sentry config. Loaded in the browser only.
 *
 * Minimal setup: errors + stack traces. No tracing, no replay,
 * no profiling — those add noise and bundle weight before we have
 * a real diagnostic need.
 *
 * DSN is read from NEXT_PUBLIC_SENTRY_DSN. If unset (e.g. local dev
 * without an account), Sentry initializes as a no-op.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  tracesSampleRate: 0,
  beforeSend(event) {
    // Strip user input from breadcrumbs and request bodies. Audio XX
    // submitted text can contain personal listening preferences and
    // partial system descriptions — we don't want any of that in error
    // reports unless the user has explicitly opted in to richer data.
    if (event.request?.data) {
      event.request.data = '[redacted]';
    }
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((bc) => {
        if (bc.data && typeof bc.data === 'object') {
          return { ...bc, data: { ...bc.data, message: '[redacted]' } };
        }
        return bc;
      });
    }
    return event;
  },
});
