/**
 * Next.js instrumentation entry — runs once per Node/Edge runtime boot.
 *
 * Sentry 10.x (Next.js 15) requires server-side and edge-side
 * `Sentry.init` calls to happen here, not in the legacy
 * `sentry.{server,edge}.config.ts` files. Client init lives in
 * `instrumentation-client.ts`.
 *
 * Initializes as a no-op when SENTRY_DSN is unset (default in dev).
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Server-side scrubbing — parity with instrumentation-client.ts.
 * Request bodies can carry user conversation text and system
 * descriptions; those must never reach the error tracker.
 */
function scrub(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request?.data) {
    event.request.data = '[redacted]';
  }
  if (event.request?.cookies) {
    event.request.cookies = {};
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
}

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
      tracesSampleRate: 0,
      sendDefaultPii: false,
      beforeSend: scrub,
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
      tracesSampleRate: 0,
      sendDefaultPii: false,
      beforeSend: scrub,
    });
  }
}

// Capture errors thrown from React Server Components / route handlers.
// No-op when DSN is unset.
export { captureRequestError as onRequestError } from '@sentry/nextjs';
