'use client';

/**
 * Assessment action bar (MVP M2).
 *
 * Quiet editorial marginalia under the artifact: Print, Copy link,
 * Save this system, New assessment. Screen-only — artifact.css hides
 * .axx-actions in print, and the ?print=1 render never mounts it.
 *
 * Copy link works because the assessment URL is self-contained: the
 * ?system= parameter IS the payload, so a pasted link renders the
 * identical assessment for anyone, forever, with no stored state.
 *
 * Save this system (M2): signed-in readers save directly (an immutable
 * assessment snapshot is stored server-side); everyone else is guided
 * to /save, where creating a free account and saving are one motion.
 */
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { track } from '@/product/analytics';
import SubscriptionPrompt from '@/product/SubscriptionPrompt';

const item: React.CSSProperties = {
  fontFamily: 'var(--face-grotesque, sans-serif)',
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#6B6862',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(27, 26, 24, 0.14)',
  paddingBottom: '2px',
  cursor: 'pointer',
  textDecoration: 'none',
};

export default function ArtifactActions({ systemText }: { systemText: string }) {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const signedIn = sessionStatus === 'authenticated';
  const [blockedState, setBlockedState] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'appended' | 'identical'>('idle');
  const [saveError, setSaveError] = useState('');
  // When signed in and this canonical system is already in the collection,
  // the action reads "Add today's assessment" and the confirmation names
  // the destination system (M3).
  const [savedMatch, setSavedMatch] = useState<{ id: string; name: string } | null>(null);
  const [savedTo, setSavedTo] = useState<{ id: string; name: string } | null>(null);
  const [blocked, setBlocked] = useState(false);

  // Funnel: an assessment reached the reader. Source = builder when the
  // System Builder set the handoff flag just before navigating.
  useEffect(() => {
    // Wait for the session to resolve so signed_in attribution is real;
    // the per-load dedupe in the analytics layer guarantees one emission.
    if (sessionStatus === 'loading') return;
    let source = 'direct';
    try {
      if (sessionStorage.getItem('axx-entry') === 'builder') {
        source = 'builder';
        sessionStorage.removeItem('axx-entry');
      }
    } catch { /* storage unavailable — count as direct */ }
    track('assessment_rendered', { source, signed_in: signedIn });
  }, [sessionStatus, signedIn]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await (await fetch('/api/auth/session')).json();
        if (!session?.user || cancelled) return;
        const res = await fetch('/api/my-systems');
        if (!res.ok || cancelled) return;
        const { systems } = await res.json();
        const canonical = systemText.trim().replace(/\s+/g, ' ');
        const match = (systems ?? []).find(
          (s: { canonicalText: string | null }) => s.canonicalText === canonical,
        );
        if (match && !cancelled) setSavedMatch({ id: match.id, name: match.name });
      } catch { /* anonymous or offline — the default label stands */ }
    })();
    return () => { cancelled = true; };
  }, [systemText]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Clipboard API unavailable (e.g. http, older browser) — select-and-
      // copy fallback via a temporary input.
      const el = document.createElement('input');
      el.value = window.location.href;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const save = async () => {
    if (saveState === 'saving') return;
    setSaveError('');
    setBlocked(false);
    setSaveState('saving');
    track('save_started', { signed_in: signedIn });
    try {
      const res = await fetch('/api/my-systems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemText }),
      });
      if (res.status === 401) {
        // Not signed in — the save page carries the account-creation flow.
        router.push(`/save?system=${encodeURIComponent(systemText)}`);
        return;
      }
      if (res.status === 403) {
        // Trial ended — a calm subscription prompt, never an error.
        const body = await res.json().catch(() => ({}));
        setBlockedState(body.entitlement?.state);
        track('trial_action_blocked', { action: savedMatch ? 'add' : 'save' });
        setSaveState('idle');
        setBlocked(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Could not save the system.');
      }
      const body = await res.json();
      setSavedTo({ id: body.systemId, name: body.name });
      setSaveState(body.identical ? 'identical' : body.duplicate ? 'appended' : 'saved');
      if (body.identical) track('identical_assessment_declined');
      else if (body.duplicate) track('assessment_added');
      else if (body.firstSystem) track('first_system_saved');
      else track('additional_system_saved');
    } catch (err) {
      setSaveState('idle');
      setSaveError(err instanceof Error ? err.message : 'Could not save the system.');
    }
  };

  const saveLabel =
    saveState === 'saving' ? 'Saving…'
    : saveState !== 'idle' ? 'Saved'
    : savedMatch ? 'Add today’s assessment'
    : 'Save this system';

  return (
    <nav className="axx-actions" aria-label="Assessment actions">
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.75rem',
          justifyContent: 'center',
          padding: '2.2rem 1rem 0.6rem',
        }}
      >
        <button type="button" style={item} onClick={() => { track('print_clicked'); window.print(); }}>
          Print
        </button>
        <button type="button" style={item} onClick={() => { track('copy_link_clicked'); copyLink(); }} data-testid="copy-link">
          {copied ? 'Link copied' : 'Copy link'}
        </button>
        <button type="button" style={item} onClick={save} data-testid="save-system">
          {saveLabel}
        </button>
        <Link href="/" style={item}>
          New assessment
        </Link>
      </div>
      {saveState !== 'idle' && saveState !== 'saving' && savedTo && (
        <p
          style={{
            textAlign: 'center',
            fontFamily: 'var(--face-text, serif)',
            fontStyle: 'italic',
            fontSize: '0.9rem',
            color: '#6B6862',
            margin: '0.6rem auto 0',
            maxWidth: '34rem',
          }}
        >
          {saveState === 'identical'
            ? <>“{savedTo.name}” already has this exact assessment saved — nothing has changed, so history was left untouched. </>
            : saveState === 'appended'
              ? <>Today’s assessment was added to “{savedTo.name}”’s history. </>
              : <>Added to your collection as “{savedTo.name}”. </>}
          <Link href={`/systems/${savedTo.id}`} style={{ color: '#1B1A18' }}>
            View the system →
          </Link>
        </p>
      )}
      {saveError && (
        <p
          style={{
            textAlign: 'center',
            fontFamily: 'var(--face-text, serif)',
            fontStyle: 'italic',
            fontSize: '0.9rem',
            color: '#A8231B',
            margin: '0.6rem auto 0',
            maxWidth: '34rem',
          }}
        >
          {saveError}
        </p>
      )}
      {blocked && (
        <div style={{ maxWidth: '34rem', margin: '1.2rem auto 0' }}>
          <SubscriptionPrompt
            context={savedMatch ? 'add' : 'save'}
            state={blockedState}
            onDismiss={() => setBlocked(false)}
          />
        </div>
      )}
    </nav>
  );
}
