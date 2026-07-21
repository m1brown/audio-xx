'use client';

import React from 'react';
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

/** Screen-only actions under a saved assessment (hidden in print). */
export default function SnapshotActions({ canonicalUrl }: { canonicalUrl: string | null }) {
  return (
    <nav className="axx-actions" aria-label="Saved assessment actions">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.75rem', justifyContent: 'center', padding: '2.2rem 1rem 0.6rem' }}>
        <button type="button" style={item} onClick={() => window.print()}>
          Print
        </button>
        {canonicalUrl && (
          <Link href={canonicalUrl} style={item}>
            Run today&rsquo;s assessment
          </Link>
        )}
        <Link href="/systems" style={item}>
          My Systems
        </Link>
      </div>
    </nav>
  );
}
