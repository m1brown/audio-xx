'use client';

/**
 * Sign in (M4 editorial restyle) — the same quiet card language as
 * /save. One pair of fields signs an existing collector in or creates
 * a free account; the destination is always My Systems.
 */
import React, { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    const res = await signIn('credentials', { email, password, redirect: false });
    if (res?.error) {
      setError('That email is already registered with a different password.');
      setBusy(false);
      return;
    }
    router.push('/systems');
  }

  return (
    <main style={{ maxWidth: '26rem', margin: '0 auto', padding: '4.5rem 1.25rem 6rem' }}>
      <div style={{ ...caps, marginBottom: '1rem' }}>Sign in</div>
      <h1
        style={{
          fontFamily: 'var(--face-display, var(--face-text))',
          fontSize: '2rem',
          lineHeight: 1.15,
          color: EDITORIAL.ink,
          margin: '0 0 0.9rem',
        }}
      >
        Your collection is waiting.
      </h1>
      <p style={{ fontFamily: 'var(--face-text)', fontSize: '1.02rem', lineHeight: 1.6, color: EDITORIAL.inkMuted, margin: '0 0 2rem' }}>
        Sign in to My&nbsp;Systems — or create your free account with the same
        two fields. Assessments themselves are always free and never need an
        account: <Link href="/" style={{ color: EDITORIAL.ink }}>build a system →</Link>
      </p>

      <form onSubmit={handleSubmit}>
        <label style={{ ...caps, display: 'block', marginBottom: '0.3rem' }} htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ ...inputStyle, marginBottom: '1.3rem' }}
        />
        <label style={{ ...caps, display: 'block', marginBottom: '0.3rem' }} htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
