'use client';

/**
 * Global error boundary for App Router. Captures React render errors
 * and forwards them to Sentry. Required for full client-side error
 * coverage per Sentry 10.x guidance.
 *
 * Initializes as a no-op when no Sentry DSN is set (default in dev).
 */

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <h2>Something went wrong.</h2>
        <p>This has been reported.</p>
      </body>
    </html>
  );
}
