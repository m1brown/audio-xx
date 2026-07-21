'use client';

/**
 * Save System (MVP M2) — where a reader becomes a collector.
 *
 * Reached from "Save this system" on an assessment when not signed in.
 * One editorial card: create your free account (or sign in — same
 * fields, accounts are created automatically) and the system is saved
 * in the same motion. The assessment itself remains free and stateless;
 * the account exists only to hold the collection.
 */
import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
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
  outline: 'none',
};

function SaveFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { status } = useSession();
  const systemText = (params.get('system') ?? '').trim();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Guards the signed-in auto-save against double-fires (strict mode, re-renders).
  const autoSaved = useRef(false);

  const persist = async (): Promise<void> => {
    const res = await fetch('/api/my-systems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemText }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'Could not save the system.');
    }
    router.push('/systems?welcome=1');
  };

  // Already signed in (e.g. deep link): save straight away.
  useEffect(() => {
    if (status === 'authenticated' && systemText && !autoSaved.current) {
      autoSaved.current = true;
      persist().catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not save the system.');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, systemText]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    // The form save IS the save — don't let the authenticated-session
    // effect fire a second one when signIn flips the status.
    autoSaved.current = true;
    try {
      const res = await signIn('credentials', { email, password, redirect: false });
      if (res?.error) {
        throw new Error('That email is already registered with a different password.');
      }
      await persist();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again.');
      setBusy(false);
    }
  };

  if (!systemText) {
    return (
      <p style={{ fontFamily: 'var(--face-text)', color: EDITORIAL.inkMuted }}>
        Nothing to save yet. <Link href="/" style={{ color: EDITORIAL.ink }}>Build your system →</Link>
      </p>
    );
  }

  const chainPreview = systemText.replace(/^assess my system:\s*/i, '');

  return (
    <div>
      <div style={{ ...caps, marginBottom: '1rem' }}>Save System</div>
      <h1
        style={{
          fontFamily: 'var(--face-display, var(--face-text))',
          fontSize: '2rem',
          lineHeight: 1.15,
          color: EDITORIAL.ink,
          margin: '0 0 0.9rem',
        }}
      >
        Begin your collection.
      </h1>
      <p style={{ fontFamily: 'var(--face-text)', fontSize: '1.02rem', lineHeight: 1.6, color: EDITORIAL.inkMuted, margin: '0 0 0.6rem' }}>
        Create your free account to save this system and begin building
        My&nbsp;Systems — your assessments, kept exactly as written, ready to
        revisit as your system evolves.
      </p>
      <p style={{ fontFamily: 'var(--face-text)', fontStyle: 'italic', fontSize: '0.92rem', color: EDITORIAL.faint, margin: '0 0 2rem' }}>
        Saving: {chainPreview}
      </p>

      {status === 'authenticated' ? (
        <p style={{ fontFamily: 'var(--face-text)', color: EDITORIAL.inkMuted }}>
          {error || 'Saving to your collection…'}
        </p>
      ) : (
        <form onSubmit={submit}>
          <label style={{ ...caps, display: 'block', marginBottom: '0.3rem' }} htmlFor="save-email">Email</label>
          <input
            id="save-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ ...inputStyle, marginBottom: '1.3rem' }}
          />
          <label style={{ ...caps, display: 'block', marginBottom: '0.3rem' }} htmlFor="save-password">Password</label>
          <input
            id="save-password"
            type="password"
            required
            minLength={8}
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
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? 'Saving…' : 'Create account & save'}
          </button>
          <p style={{ fontFamily: 'var(--face-text)', fontSize: '0.85rem', color: EDITORIAL.faint, marginTop: '1.1rem' }}>
            Already have an account? The same fields sign you in.
          </p>
        </form>
      )}
    </div>
  );
}

export default function SavePage() {
  return (
    <main style={{ maxWidth: '26rem', margin: '0 auto', padding: '4.5rem 1.25rem 6rem' }}>
      <Suspense>
        <SaveFlow />
      </Suspense>
    </main>
  );
}
