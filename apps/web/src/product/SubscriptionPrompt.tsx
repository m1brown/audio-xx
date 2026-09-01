'use client';

/**
 * Subscription prompt (MVP M5) — the humane paywall card.
 *
 * Shown when an expired user attempts a collection-management action,
 * or inline on My Systems after trial expiry. The message is always:
 * your collection is still here; subscribe to continue adding to and
 * managing it. Never an error, never a dead end, never a suggestion
 * that anything was lost.
 */
import React, { useEffect, useState } from 'react';
import { EDITORIAL } from '@/lib/editorial-tokens';
import { track } from './analytics';

const caps: React.CSSProperties = {
  fontFamily: 'var(--face-grotesque)',
  fontSize: '0.65rem',
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: EDITORIAL.inkMuted,
};

export default function SubscriptionPrompt(
  { context = 'manage', state, onDismiss }: {
    context?: 'save' | 'add' | 'rename' | 'notes' | 'manage';
    /** Entitlement state at the moment the prompt appears (spec prop). */
    state?: string;
    onDismiss?: () => void;
  },
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    track('subscription_prompt_viewed', { state, action: context });
  }, [context, state]);

  const subscribe = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    track('checkout_started', { action: context });
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      const body = await res.json();
      if (!res.ok || !body.url) throw new Error(body.error ?? 'Could not start checkout.');
      window.location.href = body.url;
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Could not start checkout.');
    }
  };

  return (
    <aside
      aria-label="Subscribe to My Systems"
      style={{
        border: `1px solid ${EDITORIAL.hairline}`,
        background: '#FFFFFF',
        padding: '1.6rem 1.5rem 1.5rem',
        maxWidth: '34rem',
      }}
    >
      <div style={{ ...caps, color: EDITORIAL.accent, marginBottom: '0.7rem' }}>My Systems</div>
      <p style={{ fontFamily: 'var(--face-display, var(--face-text))', fontSize: '1.35rem', lineHeight: 1.25, color: EDITORIAL.ink, margin: '0 0 0.8rem' }}>
        Your collection is still here.
      </p>
      <p style={{ fontFamily: 'var(--face-text)', fontSize: '0.98rem', lineHeight: 1.6, color: EDITORIAL.inkMuted, margin: '0 0 0.6rem' }}>
        Your free trial has ended. Everything you saved remains yours to read,
        print, and share — and assessments themselves stay free, always.
        Subscribing lets you keep building: saving new systems, adding new
        assessments to their history, and editing names and notes.
      </p>
      <p style={{ fontFamily: 'var(--face-text)', fontSize: '0.98rem', color: EDITORIAL.ink, margin: '0 0 1.2rem' }}>
        $3 a month · cancel anytime
      </p>
      {error && (
        <p style={{ fontFamily: 'var(--face-text)', fontStyle: 'italic', fontSize: '0.9rem', color: EDITORIAL.accent, margin: '0 0 0.9rem' }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.4rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={subscribe}
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
            padding: '0.65rem 1.3rem',
            minHeight: '44px',
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.75 : 1,
          }}
        >
          {busy ? 'Opening checkout…' : 'Subscribe'}
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            style={{ ...caps, background: 'transparent', border: 'none', borderBottom: `1px solid ${EDITORIAL.hairline}`, paddingBottom: '1px', cursor: 'pointer' }}
          >
            Not now
          </button>
        )}
      </div>
    </aside>
  );
}
