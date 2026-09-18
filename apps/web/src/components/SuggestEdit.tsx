'use client';

/**
 * Suggested Edits — Slice 1 affordance + capture sheet.
 *
 * A quiet correction mechanism, not a social feature. The trigger is a
 * muted text link in the product-chrome family (tooling, not editorial —
 * same doctrine as FeedbackPrompt); the sheet is three fields and takes
 * under a minute. Internal vocabulary (evidence classes, tiers, product
 * keys, moderation states) is never exposed.
 *
 * Trust boundary: submission POSTs to /api/contributions, which stores an
 * inert pending record. Nothing a user types here changes what Audio XX
 * knows or says — the confirmation copy states that contract plainly.
 */
import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { trackEvent } from '@/lib/track-event';

/**
 * The dossier card renders in contexts without a SessionProvider (snapshot
 * artifacts, render tests). Absent a provider, degrade to the signed-out
 * state rather than requiring every render context to know about auth.
 */
function useOptionalSession(): { data: { user?: unknown } | null } {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- useSession's
    // context read completes before it throws, so hook order is preserved.
    return useSession();
  } catch {
    return { data: null };
  }
}

const REASONS: Array<{ value: string; label: string }> = [
  { value: 'wrong', label: 'Something here is wrong' },
  { value: 'missing', label: 'Something is missing' },
  { value: 'wrong_product', label: 'This is the wrong product or version' },
  { value: 'owner_info', label: 'I own or use this and can add information' },
];

export interface SuggestEditProps {
  /** Display name shown in the sheet title (and stored for review). */
  productName: string;
  /** Resolved identity, when Audio XX has one. */
  productKey?: string;
  /** Where the affordance lives — stored verbatim for review context. */
  surface: string;
  /** Sparse/uncertain-knowledge variant: invites help instead of correction. */
  sparse?: boolean;
  /** The specific spec/evidence line, when the edit starts from one. */
  evidenceRef?: string;
}

export default function SuggestEdit(props: SuggestEditProps) {
  const { data: session } = useOptionalSession();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const signedIn = !!session?.user;
  const knownIdentity = !!props.productKey;

  const openSheet = () => {
    setOpen(true);
    trackEvent('suggested_edit_opened', {
      surface: props.surface, knownIdentity, sparse: !!props.sparse,
    });
  };

  const submit = async () => {
    if (!reason || text.trim().length < 3 || state === 'sending') return;
    setState('sending');
    setError(null);
    try {
      const res = await fetch('/api/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surface: props.surface,
          productKey: props.productKey,
          productName: props.productName,
          // The user's own words carry identity when Audio XX has none —
          // never silently converted; identity work belongs to review.
          typedProduct: knownIdentity ? undefined : props.productName,
          evidenceRef: props.evidenceRef,
          reason,
          text: text.trim(),
          sourceUrl: sourceUrl.trim() || undefined,
        }),
      });
      if (res.ok) {
        trackEvent('suggested_edit_submitted', {
          surface: props.surface, knownIdentity, reason,
          sourced: !!sourceUrl.trim(),
        });
        setState('done');
      } else {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? 'could not save your suggestion');
        setState('error');
      }
    } catch {
      setError('could not save your suggestion');
      setState('error');
    }
  };

  const trigger = props.sparse
    ? <span>Know this product? <span style={{ textDecoration: 'underline' }}>Help improve Audio&nbsp;XX.</span></span>
    : <span>Suggest an edit</span>;

  if (!open) {
    return (
      <button
        type="button"
        onClick={openSheet}
        data-print-hide
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: '0.72rem', letterSpacing: '0.06em',
          color: 'rgba(27,26,24,0.45)', textAlign: 'left',
        }}
        aria-label={`Suggest an edit for ${props.productName}`}
      >
        {trigger}
      </button>
    );
  }

  if (state === 'done') {
    return (
      <p style={{ fontSize: '0.84rem', color: 'rgba(27,26,24,0.6)', margin: '0.4rem 0 0 0', maxWidth: 460 }}>
        Thank you. A person reviews every suggestion before Audio&nbsp;XX&rsquo;s knowledge changes.
      </p>
    );
  }

  if (!signedIn) {
    return (
      <p style={{ fontSize: '0.84rem', color: 'rgba(27,26,24,0.6)', margin: '0.4rem 0 0 0' }}>
        Sign in to suggest an edit — every suggestion is reviewed by a person.
      </p>
    );
  }

  const label: React.CSSProperties = {
    fontSize: '0.8rem', color: 'rgba(27,26,24,0.75)', margin: 0,
  };

  return (
    <div
      data-print-hide
      aria-label={`Suggest an edit for ${props.productName}`}
      style={{
        marginTop: '0.6rem', padding: '0.85rem 1rem', maxWidth: 460,
        background: '#f4f7fb', border: '1px solid #d9e2ef', borderRadius: 8,
        display: 'flex', flexDirection: 'column', gap: '0.55rem',
      }}
    >
      <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2b5e9e', margin: 0 }}>
        Suggest an edit — {props.productName}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {REASONS.map((r) => (
          <label key={r.value} style={{ ...label, display: 'flex', gap: '0.45rem', alignItems: 'baseline', cursor: 'pointer' }}>
            <input
              type="radio" name={`suggest-reason-${props.surface}`} value={r.value}
              checked={reason === r.value} onChange={() => setReason(r.value)}
            />
            {r.label}
          </label>
        ))}
      </div>

      <label style={label}>
        Tell us what you know
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000}
          style={{ display: 'block', width: '100%', marginTop: '0.25rem', fontSize: '0.85rem', padding: '0.4rem', border: '1px solid #d9e2ef', borderRadius: 6, fontFamily: 'inherit' }}
        />
      </label>

      <label style={label}>
        Source, if you have one
        <input
          type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://…" maxLength={1000}
          style={{ display: 'block', width: '100%', marginTop: '0.25rem', fontSize: '0.85rem', padding: '0.35rem 0.4rem', border: '1px solid #d9e2ef', borderRadius: 6, fontFamily: 'inherit' }}
        />
      </label>

      {error && <p style={{ ...label, color: '#8a3b2e' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
        <button
          type="button" onClick={submit}
          disabled={!reason || text.trim().length < 3 || state === 'sending'}
          style={{
            fontSize: '0.8rem', padding: '0.35rem 0.9rem', borderRadius: 6,
            border: '1px solid #2b5e9e', background: '#2b5e9e', color: '#fff',
            cursor: 'pointer', opacity: !reason || text.trim().length < 3 ? 0.5 : 1,
          }}
        >
          {state === 'sending' ? 'Sending…' : 'Submit'}
        </button>
        <button
          type="button" onClick={() => setOpen(false)}
          style={{ fontSize: '0.8rem', background: 'none', border: 'none', color: 'rgba(27,26,24,0.5)', cursor: 'pointer', padding: 0 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
