'use client';

/**
 * Artifact actions on a completed conversation assessment.
 *
 *   View Assessment   -> /artifact/<viewToken>          private, render-only
 *   Print / Save PDF  -> /artifact/<viewToken>?print=1  same private snapshot
 *   Share             -> mints shareToken, then /artifact/s/<shareToken>
 *
 * Print and Share are separate actions on purpose. Printing opens the private
 * artifact and nothing else; only Share calls the API action that mints public
 * access. There is deliberately no code path from the print handler to
 * `shareArtifactSnapshot`.
 *
 * Nothing here routes through the legacy `/artifact?system=` route, which
 * re-assesses rather than rendering.
 */
import React, { useState } from 'react';
import { shareArtifactSnapshot } from '@/product/create-artifact-snapshot';
import { COLOR } from '@/lib/editorial-tokens';

const action: React.CSSProperties = {
  fontFamily: 'var(--face-grotesque, sans-serif)',
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: COLOR.textMuted,
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(27,26,24,0.16)',
  padding: '0 0 2px 0',
  cursor: 'pointer',
  textDecoration: 'none',
};

export default function ArtifactActionsInline(
  { viewToken }: { viewToken?: string },
) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  // No token means the snapshot could not be stored. Offering an artifact that
  // cannot be opened is worse than offering none.
  if (!viewToken) return null;

  const artifactUrl = `/artifact/${encodeURIComponent(viewToken)}`;

  const onShare = async () => {
    if (shareUrl) { await copy(shareUrl); return; }
    setSharing(true);
    const token = await shareArtifactSnapshot(viewToken);
    setSharing(false);
    if (!token) return;
    const url = `${window.location.origin}/artifact/s/${encodeURIComponent(token)}`;
    setShareUrl(url);
    await copy(url);
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch { /* the link is on screen either way */ }
  };

  return (
    <div
      // Screen affordances. A printed assessment has no controls, and these
      // appeared on page 4 of a listener's browser print.
      data-print-hide
      style={{
      display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center',
      marginTop: '1.6rem', paddingTop: '0.9rem',
      borderTop: '1px solid rgba(27,26,24,0.10)',
    }}>
      <a href={artifactUrl} style={action}>View assessment</a>
      {/* Opens the SAME private snapshot with the print dialog armed. */}
      <a href={`${artifactUrl}?print=1`} target="_blank" rel="noopener noreferrer" style={action}>
        Print / Save PDF
      </a>
      <button type="button" onClick={onShare} style={action} disabled={sharing}>
        {sharing ? 'Creating link…' : copied ? 'Link copied' : shareUrl ? 'Copy link' : 'Share'}
      </button>
      {shareUrl && (
        <span style={{
          fontSize: '0.72rem', color: COLOR.textMuted, wordBreak: 'break-all',
        }}>
          {shareUrl}
        </span>
      )}
    </div>
  );
}
