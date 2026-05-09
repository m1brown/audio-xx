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

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
      tracesSampleRate: 0,
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
      tracesSampleRate: 0,
    });
  }
}

// Capture errors thrown from React Server Components / route handlers.
// No-op when DSN is unset.
export { captureRequestError as onRequestError } from '@sentry/nextjs';
