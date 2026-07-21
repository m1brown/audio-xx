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
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  const [copied, setCopied] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'already'>('idle');
  const [saveError, setSaveError] = useState('');

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
    setSaveState('saving');
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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Could not save the system.');
      }
      const body = await res.json();
      setSaveState(body.duplicate ? 'already' : 'saved');
    } catch (err) {
      setSaveState('idle');
      setSaveError(err instanceof Error ? err.message : 'Could not save the system.');
    }
  };

  const saveLabel =
    saveState === 'saving' ? 'Saving…'
    : saveState === 'saved' ? 'Saved'
    : saveState === 'already' ? 'Saved'
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
        <button type="button" style={item} onClick={() => window.print()}>
          Print
        </button>
        <button type="button" style={item} onClick={copyLink} data-testid="copy-link">
          {copied ? 'Link copied' : 'Copy link'}
        </button>
        <button type="button" style={item} onClick={save} data-testid="save-system">
          {saveLabel}
        </button>
        <Link href="/" style={item}>
          New assessment
        </Link>
      </div>
      {(saveState === 'saved' || saveState === 'already') && (
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
          {saveState === 'already'
            ? 'Already in your collection — today’s assessment has been added to its history. '
            : 'Added to your collection. '}
          <Link href="/systems" style={{ color: '#1B1A18' }}>View My Systems →</Link>
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
    </nav>
  );
}
