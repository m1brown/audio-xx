'use client';

/**
 * Shown on /auth/forgot and /auth/reset whenever self-service password
 * recovery is switched off.
 *
 * Colocated rather than living inside either page so both routes can share
 * it without one route file importing another.
 *
 * States plainly that the flow is unavailable and names the route that does
 * work. The alternative — leaving the real form reachable by URL — meant a
 * "disabled" recovery flow still accepted an address and reported success.
 */

import React from 'react';
import Link from 'next/link';
import { EDITORIAL } from '@/lib/editorial-tokens';

const caps: React.CSSProperties = {
  fontFamily: 'var(--face-grotesque, var(--face-text))',
  fontSize: '0.72rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: EDITORIAL.inkMuted,
};

export default function RecoveryUnavailable() {
  return (
    <main style={{ maxWidth: '26rem', margin: '0 auto', padding: '4.5rem 1.25rem 6rem' }}>
      <div style={{ ...caps, marginBottom: '1rem' }}>Password reset</div>
      <h1
        style={{
          fontFamily: 'var(--face-display, var(--face-text))',
          fontSize: '2rem',
          lineHeight: 1.15,
          color: EDITORIAL.ink,
          margin: '0 0 1.2rem',
        }}
      >
        Password reset is unavailable.
      </h1>
      <p style={{ fontFamily: 'var(--face-text)', color: EDITORIAL.inkMuted, marginBottom: '1.4rem' }}>
        Self-service password reset is switched off at the moment. Email{' '}
        <a
          href="mailto:hello@audio-xx.com?subject=Audio%20XX%20account%20access"
          style={{ color: EDITORIAL.ink }}
        >
          hello@audio-xx.com
        </a>{' '}
        and we will restore your access.
      </p>
      <Link href="/auth/signin" style={{ fontFamily: 'var(--face-text)', color: EDITORIAL.ink }}>
        ← Back to sign in
      </Link>
    </main>
  );
}
