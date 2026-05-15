'use client';

/**
 * Global error boundary for App Router. Captures React render errors
 * and forwards them to Sentry. Required for full client-side error
 * coverage per Sentry 10.x guidance.
 *
 * Initializes as a no-op when no Sentry DSN is set (default in dev).
 *
 * Stage 8.2 polish: the prior screen was a dead-end. Added a
 * "Try again" button wired to the App Router's `reset` callback
 * (re-runs the failed render path) and a "Report issue" mailto link
 * that prefills a structured body so users describe the failure
 * mode without needing an in-app feedback widget. Visual treatment
 * matches the homepage "Add your system" CTA — calm, editorial,
 * hairline border, no SaaS color fill.
 */

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

const REPORT_MAILTO = (() => {
  const subject = encodeURIComponent('Audio XX error report');
  const body = encodeURIComponent(
    [
      'What were you trying to do?',
      '',
      '',
      'What went wrong?',
      '',
      '',
      'What did you expect?',
      '',
      '',
      '— Audio XX error screen',
    ].join('\n'),
  );
  return `mailto:hello@audio-xx.com?subject=${subject}&body=${body}`;
})();

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
          background: '#FCFCFB',
          color: '#2A2A2A',
          margin: 0,
          padding: '4rem 1.5rem',
          minHeight: '100vh',
          lineHeight: 1.55,
        }}
      >
        <div style={{ maxWidth: '36rem', margin: '0 auto' }}>
          <h2 style={{
            margin: '0 0 0.75rem 0',
            fontSize: '1.3rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: '#2A2A2A',
          }}>
            Something went wrong.
          </h2>
          <p style={{
            margin: '0 0 1.5rem 0',
            fontSize: '0.95rem',
            color: '#5A5A5A',
          }}>
            This has been reported. You can try again, or send us a note if it
            keeps happening.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.9rem',
                background: 'transparent',
                border: '1px solid #2A2A2A',
                borderRadius: 3,
                color: '#2A2A2A',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                fontWeight: 500,
                lineHeight: 1.4,
                cursor: 'pointer',
              }}
            >
              <span>Try again</span>
              <span aria-hidden="true">→</span>
            </button>
            <a
              href={REPORT_MAILTO}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.9rem',
                background: 'transparent',
                border: '1px solid #E5E5E5',
                borderRadius: 3,
                color: '#5A5A5A',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                fontWeight: 500,
                lineHeight: 1.4,
                textDecoration: 'none',
              }}
            >
              <span>Report issue</span>
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
