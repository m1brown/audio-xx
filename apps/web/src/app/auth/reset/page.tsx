'use client';

/**
 * Reset password (pre-beta item 3) — completes the emailed reset link.
 * Token arrives as ?token=…; it is posted to /api/auth/reset which
 * verifies hash + expiry + single-use before changing the password.
 */
import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { EDITORIAL } from '@/lib/editorial-tokens';
import { passwordResetEnabled } from '@/lib/password-reset-flag';
import RecoveryUnavailable from '../RecoveryUnavailable';

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

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || 'Something went wrong. Request a new link.');
        setBusy(false);
        return;
      }
      setDone(true);
      setTimeout(() => router.push('/auth/signin'), 2500);
    } catch {
      setError('Network error — please try again.');
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <p style={{ fontFamily: 'var(--face-text)', fontSize: '1.02rem', lineHeight: 1.6, color: EDITORIAL.inkMuted }}>
        This reset link is incomplete.{' '}
        <Link href="/auth/forgot" style={{ color: EDITORIAL.ink }}>Request a new one →</Link>
      </p>
    );
  }

  if (done) {
    return (
      <p style={{ fontFamily: 'var(--face-text)', fontSize: '1.02rem', lineHeight: 1.6, color: EDITORIAL.inkMuted }}>
        Your password has been updated. Taking you to sign in…
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <label style={{ ...caps, display: 'block', marginBottom: '0.3rem' }} htmlFor="password">New password</label>
      <input
        id="password"
        type="password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ ...inputStyle, marginBottom: '1.3rem' }}
      />
      <label style={{ ...caps, display: 'block', marginBottom: '0.3rem' }} htmlFor="confirm">Confirm password</label>
      <input
        id="confirm"
        type="password"
        required
        minLength={8}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        style={{ ...inputStyle, marginBottom: '1.6rem' }}
      />
      {error && (
        <p style={{ fontFamily: 'var(--face-text)', fontStyle: 'italic', fontSize: '0.9rem', color: EDITORIAL.accent, margin: '0 0 1rem' }}>
          {error}
        </p>
      )}
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
        {busy ? 'Updating…' : 'Set new password'}
      </button>
    </form>
  );
}

export default function ResetPassword() {
  // Recovery disabled: no token may be redeemed. A reset link minted before
  // the flag was switched off must not remain spendable through a direct URL.
  if (!passwordResetEnabled()) return <RecoveryUnavailable />;

  return (
    <main style={{ maxWidth: '26rem', margin: '0 auto', padding: '4.5rem 1.25rem 6rem' }}>
      <div style={{ ...caps, marginBottom: '1rem' }}>Password reset</div>
      <h1
        style={{
          fontFamily: 'var(--face-display, var(--face-text))',
          fontSize: '2rem',
          lineHeight: 1.15,
          color: EDITORIAL.ink,
          margin: '0 0 1.6rem',
        }}
      >
        Choose a new password.
      </h1>
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
    </main>
  );
}
