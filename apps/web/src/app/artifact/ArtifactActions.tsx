'use client';

/**
 * Assessment action bar (MVP M1).
 *
 * Quiet editorial marginalia under the artifact: Print, Copy link,
 * Save this system, New assessment. Screen-only — artifact.css hides
 * .axx-actions in print, and the ?print=1 render never mounts it.
 *
 * Copy link works because the assessment URL is self-contained: the
 * ?system= parameter IS the payload, so a pasted link renders the
 * identical assessment for anyone, forever, with no stored state.
 *
 * Save this system is an honest placeholder until Milestone 2
 * (My Systems): it explains that the link is the save, for now.
 */
import React, { useState } from 'react';
import Link from 'next/link';

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

export default function ArtifactActions() {
  const [copied, setCopied] = useState(false);
  const [saveNote, setSaveNote] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API unavailable (e.g. http, older browser) — select-and-
      // copy fallback via a temporary input.
      const el = document.createElement('input');
      el.value = window.location.href;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

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
        <button type="button" style={item} onClick={() => setSaveNote((v) => !v)}>
          Save this system
        </button>
        <Link href="/" style={item}>
          New assessment
        </Link>
      </div>
      {saveNote && (
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
          My Systems — saved collections with updated assessments — is coming
          soon. Until then, this page&rsquo;s link is permanent: copy it and the
          assessment is yours to keep.
        </p>
      )}
    </nav>
  );
}
