'use client';

/**
 * Forgot password (pre-beta item 3) — same quiet card language as
 * /auth/signin. Submits to /api/auth/forgot, which is enumeration-safe:
 * the confirmation copy is identical whether or not the account exists.
 *
 * This page is only linked from the sign-in card when
 * NEXT_PUBLIC_PASSWORD_RESET is enabled (i.e. email delivery is
 * configured) — users are never shown a recovery flow that cannot
 * deliver mail.
 */
import React, { useState } from 'react';
import Link from 'next/link';
import { EDITORIAL } from '@/lib/editorial-tokens';

const caps: React.CSSProperties = {
  fontFamily: 'var(--face-grotesque)',
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: EDITORIAL.inkMuted,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: 'var(--face-text)',
  fontSize: '1.05rem',
  color: EDITORIAL.ink,
  background: 'transparent',
  border: 'none',
  borderBottom: `1px solid ${EDITORIAL.hairline}`,
  padding: '0.35rem 0.1rem',
  minHeight: '44px',
  outline: 'none',
};

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      /* uniform confirmation regardless */
    }
    setSent(true);
    setBusy(false);
  }

  return (
    <main style={{ maxWidth: '26rem', margin: '0 auto', padding: '4.5rem 1.25rem 6rem' }}>
      <div style={{ ...caps, marginBottom: '1rem' }}>Password reset</div>
      <h1
        style={{
          fontFamily: 'var(--face-display, var(--face-text))',
          fontSize: '2rem',
          lineHeight: 1.15,
          color: EDITORIAL.ink,
          margin: '0 0 0.9rem',
        }}
      >
        Forgot your password?
      </h1>

      {sent ? (
        <p style={{ fontFamily: 'var(--face-text)', fontSize: '1.02rem', lineHeight: 1.6, color: EDITORIAL.inkMuted }}>
          If an account exists for that address, a reset link is on its way.
          It stays valid for 30 minutes.{' '}
          <Link href="/auth/signin" style={{ color: EDITORIAL.ink }}>Back to sign in →</Link>
        </p>
      ) : (
        <>
          <p style={{ fontFamily: 'var(--face-text)', fontSize: '1.02rem', lineHeight: 1.6, color: EDITORIAL.inkMuted, margin: '0 0 2rem' }}>
            Enter the email you signed up with and we’ll send a reset link.
          </p>
          <form onSubmit={handleSubmit}>
            <label style={{ ...caps, display: 'block', marginBottom: '0.3rem' }} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ ...inputStyle, marginBottom: '1.6rem' }}
            />
            <button
              type="submit"
              disabled={busy}
              style={{
                fontFamily: 'var(--face-grotesque)',
                fontSize: '0.8rem',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: EDITORIAL.paper,
                background: EDITORIAL.ink,
                border: `1px solid ${EDITORIAL.ink}`,
                padding: '0.7rem 1.4rem',
                minHeight: '44px',
                cursor: busy ? 'default' : 'pointer',
                opacity: busy ? 0.75 : 1,
              }}
            >
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        </>
      )}
    </main>
  );
}
