'use client';

/**
 * Account (MVP M5) — the minimal billing surface, not a settings centre:
 * status, next billing date where known, price, Manage subscription
 * (Stripe-hosted portal), sign out. Also the checkout return landing
 * (?checkout=success|cancelled), where a successful session is
 * server-verified and synced so activation is immediate.
 */
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { EDITORIAL } from '@/lib/editorial-tokens';
import type { Entitlement } from '@/product/entitlement';
import { statusLine } from '@/product/entitlement-copy';
import SubscriptionPrompt from '@/product/SubscriptionPrompt';
import { track } from '@/product/analytics';

const caps: React.CSSProperties = {
  fontFamily: 'var(--face-grotesque)',
  fontSize: '0.65rem',
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: EDITORIAL.inkMuted,
};

const quiet: React.CSSProperties = {
  ...caps,
  background: 'transparent',
  border: 'none',
  borderBottom: `1px solid ${EDITORIAL.hairline}`,
  paddingBottom: '1px',
  cursor: 'pointer',
};

function AccountBody() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const checkout = params.get('checkout');
  const sessionId = params.get('session_id');
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [statusUnavailable, setStatusUnavailable] = useState(false);
  const [portalError, setPortalError] = useState('');

  const load = useCallback(async () => {
    try {
      const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : '';
      const res = await fetch(`/api/billing/status${qs}`);
      if (!res.ok) { setStatusUnavailable(true); return; }
      const body = await res.json();
      setEntitlement(body.entitlement);
      setStatusUnavailable(false);
    } catch {
      setStatusUnavailable(true);
    }
  }, [sessionId]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated') load();
  }, [status, router, load]);

  useEffect(() => {
    if (checkout === 'cancelled') track('checkout_cancelled');
  }, [checkout]);

  const openPortal = async () => {
    setPortalError('');
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const body = await res.json();
      if (!res.ok || !body.url) throw new Error(body.error ?? 'Could not open billing management.');
      window.location.href = body.url;
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Could not open billing management.');
    }
  };

  if (status !== 'authenticated') return null;

  return (
    <main style={{ maxWidth: '30rem', margin: '0 auto', padding: '4rem 1.25rem 6rem' }}>
      <div style={{ ...caps, marginBottom: '0.9rem' }}>{session?.user?.email}</div>
      <h1 style={{ fontFamily: 'var(--face-display, var(--face-text))', fontSize: '2.2rem', lineHeight: 1.1, color: EDITORIAL.ink, margin: '0 0 1.6rem' }}>
        Account
      </h1>

      {checkout === 'success' && (
        <p style={{ fontFamily: 'var(--face-text)', fontStyle: 'italic', color: EDITORIAL.ink, margin: '0 0 1.4rem' }}>
          Welcome to My Systems. Your subscription is
          {entitlement?.canManage && entitlement.hasSubscription ? ' active' : ' being activated — this takes a moment'}.
        </p>
      )}
      {checkout === 'cancelled' && (
        <p style={{ fontFamily: 'var(--face-text)', fontStyle: 'italic', color: EDITORIAL.inkMuted, margin: '0 0 1.4rem' }}>
          Checkout was cancelled — nothing was charged. Your collection is
          unchanged.
        </p>
      )}

      <section style={{ borderTop: `1px solid ${EDITORIAL.hairline}`, paddingTop: '1.2rem', marginBottom: '2rem' }}>
        {statusUnavailable ? (
          <p style={{ fontFamily: 'var(--face-text)', color: EDITORIAL.inkMuted, margin: 0 }}>
            Billing status is temporarily unavailable. Your collection is
            unaffected — try again shortly.
          </p>
        ) : entitlement ? (
          <>
            <p style={{ fontFamily: 'var(--face-text)', fontSize: '1.05rem', color: EDITORIAL.ink, margin: '0 0 0.35rem' }}>
              {statusLine(entitlement)}
            </p>
            <p style={{ fontFamily: 'var(--face-text)', fontSize: '0.9rem', color: EDITORIAL.faint, margin: 0 }}>
              {entitlement.hasSubscription
                ? `My Systems · $3 a month · cancel anytime${entitlement.paidThrough ? ` · next period ends ${new Date(entitlement.paidThrough).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}`
                : 'My Systems · $3 a month after the free trial · cancel anytime'}
            </p>
            {entitlement.hasSubscription && (
              <div style={{ marginTop: '1rem' }}>
                <button type="button" style={quiet} onClick={openPortal}>
                  Manage subscription
                </button>
                {portalError && (
                  <p style={{ fontFamily: 'var(--face-text)', fontStyle: 'italic', fontSize: '0.88rem', color: EDITORIAL.accent, marginTop: '0.6rem' }}>
                    {portalError}
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <p style={{ fontFamily: 'var(--face-text)', color: EDITORIAL.faint, margin: 0 }}>Loading…</p>
        )}
      </section>

      {entitlement && !entitlement.canManage && (
        <div style={{ marginBottom: '2rem' }}>
          <SubscriptionPrompt context="manage" state={entitlement?.state} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '1.6rem', flexWrap: 'wrap' }}>
        <Link href="/systems" style={{ ...quiet, textDecoration: 'none' }}>My Systems</Link>
        <button type="button" style={quiet} onClick={() => signOut({ callbackUrl: '/' })}>
          Sign out
        </button>
      </div>
    </main>
  );
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountBody />
    </Suspense>
  );
}
