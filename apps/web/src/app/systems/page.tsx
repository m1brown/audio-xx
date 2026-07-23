'use client';

/**
 * My Systems (MVP M2) — the collection.
 *
 * One card per saved system: name (renamed inline), the chain, the
 * latest assessment's verdict and date, optional notes. Reading like a
 * contents page of a personal publication, not a dashboard.
 *
 * Cards open the saved assessment exactly as it was written (immutable
 * snapshot). "Use in conversation" keeps the existing saved-system
 * activation bridge to the advisory chat.
 */
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAudioSession } from '@/lib/audio-session-context';
import { EDITORIAL } from '@/lib/editorial-tokens';
import type { Entitlement } from '@/product/entitlement';
import { statusLine } from '@/product/entitlement-copy';
import SubscriptionPrompt from '@/product/SubscriptionPrompt';
import { track } from '@/product/analytics';

interface MySystem {
  id: string;
  name: string;
  notes: string | null;
  chain: string[];
  verdict: string | null;
  assessedAt: string | null;
  engineVersion: string | null;
  updatedAt: string;
  canonicalText: string | null;
  snapshotCount: number;
}

const caps: React.CSSProperties = {
  fontFamily: 'var(--face-grotesque)',
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: EDITORIAL.inkMuted,
};

const quietLink: React.CSSProperties = {
  ...caps,
  fontSize: '0.65rem',
  color: EDITORIAL.inkMuted,
  background: 'transparent',
  border: 'none',
  borderBottom: `1px solid ${EDITORIAL.hairline}`,
  paddingBottom: '1px',
  cursor: 'pointer',
  textDecoration: 'none',
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function MySystemsList() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const welcome = params.get('welcome') === '1';
  const [systems, setSystems] = useState<MySystem[] | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const { helpers } = useAudioSession();

  const load = useCallback(() => {
    fetch('/api/my-systems')
      .then((r) => (r.ok ? r.json() : { systems: [] }))
      .then((d) => {
        setSystems(d.systems ?? []);
        setEntitlement(d.entitlement ?? null);
      })
      .catch(() => setSystems([]));
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated') { load(); track('my_systems_viewed'); }
  }, [status, router, load]);

  if (status !== 'authenticated') return null;

  const rename = async (id: string) => {
    const name = renameValue.trim();
    setRenaming(null);
    if (!name) return;
    const res = await fetch(`/api/my-systems/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.status === 403) {
      track('trial_action_blocked', { action: 'rename' });
      setShowPrompt(true);
      return;
    }
    load();
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Remove “${name}” from your collection? Its saved assessments go with it.`)) return;
    await fetch(`/api/my-systems/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <main style={{ maxWidth: '42rem', margin: '0 auto', padding: '4rem 1.25rem 6rem' }}>
      <div style={{ ...caps, marginBottom: '0.9rem' }}>
        {session?.user?.email}
      </div>
      <h1
        style={{
          fontFamily: 'var(--face-display, var(--face-text))',
          fontSize: '2.6rem',
          lineHeight: 1.1,
          color: EDITORIAL.ink,
          margin: '0 0 0.75rem',
        }}
      >
        My Systems
      </h1>
      <p style={{ fontFamily: 'var(--face-text)', fontStyle: 'italic', color: EDITORIAL.inkMuted, margin: '0 0 0.9rem' }}>
        {welcome
          ? 'Your collection has begun. Every assessment here is kept exactly as it was written.'
          : 'Assessments, kept exactly as written, ready to revisit as your systems evolve.'}
      </p>
      {entitlement && (
        <p style={{ ...caps, fontSize: '0.62rem', color: EDITORIAL.faint, margin: '0 0 3rem' }}>
          {statusLine(entitlement)}
          {' · '}
          <Link href="/account" style={{ color: EDITORIAL.faint }}>Account</Link>
        </p>
      )}
      {!entitlement && <div style={{ marginBottom: '2.1rem' }} />}

      {entitlement && (!entitlement.canManage || showPrompt) && (
        <div style={{ marginBottom: '2.5rem' }}>
          <SubscriptionPrompt context="manage" onDismiss={showPrompt ? () => setShowPrompt(false) : undefined} />
        </div>
      )}

      {systems === null ? null : systems.length === 0 ? (
        <p style={{ fontFamily: 'var(--face-text)', color: EDITORIAL.inkMuted }}>
          No systems yet.{' '}
          <Link href="/" style={{ color: EDITORIAL.ink }}>Build your first →</Link>
        </p>
      ) : (
        systems.map((sys) => (
          <article
            key={sys.id}
            style={{
              borderTop: `1px solid ${EDITORIAL.hairline}`,
              padding: '1.75rem 0 1.9rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
              {renaming === sys.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => rename(sys.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') rename(sys.id);
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  style={{
                    fontFamily: 'var(--face-display, var(--face-text))',
                    fontSize: '1.45rem',
                    color: EDITORIAL.ink,
                    background: 'transparent',
                    border: 'none',
                    borderBottom: `1px solid ${EDITORIAL.hairline}`,
                    outline: 'none',
                    width: '100%',
                  }}
                />
              ) : (
                <h2 style={{ fontFamily: 'var(--face-display, var(--face-text))', fontSize: '1.45rem', color: EDITORIAL.ink, margin: 0, overflowWrap: 'anywhere' }}>
                  <Link href={`/systems/${sys.id}`} style={{ color: EDITORIAL.ink, textDecoration: 'none' }}>{sys.name}</Link>
                </h2>
              )}
              <span style={{ ...caps, fontSize: '0.62rem', whiteSpace: 'nowrap', color: EDITORIAL.faint }}>
                {formatDate(sys.assessedAt ?? sys.updatedAt)}
                {sys.snapshotCount > 1 ? ` · ${sys.snapshotCount} assessments` : ''}
              </span>
            </div>

            {sys.chain.length > 0 && (
              <p style={{ fontFamily: 'var(--face-text)', fontSize: '0.95rem', color: EDITORIAL.inkMuted, margin: '0.45rem 0 0' }}>
                {sys.chain.join(' · ')}
              </p>
            )}
            {sys.verdict && (
              <p style={{ fontFamily: 'var(--face-text)', fontStyle: 'italic', fontSize: '1rem', color: EDITORIAL.ink, margin: '0.7rem 0 0' }}>
                “{sys.verdict}”
              </p>
            )}
            {sys.notes && (
              <p style={{ fontFamily: 'var(--face-text)', fontSize: '0.9rem', color: EDITORIAL.faint, margin: '0.6rem 0 0' }}>
                {sys.notes}
              </p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.4rem', marginTop: '1rem' }}>
              {sys.snapshotCount > 0 && (
                <Link href={`/systems/${sys.id}/assessment`} style={quietLink}>
                  Latest assessment
                </Link>
              )}
              {sys.snapshotCount > 1 && (
                <Link href={`/systems/${sys.id}`} style={quietLink}>
                  History
                </Link>
              )}
              <button
                type="button"
                style={quietLink}
                onClick={() => { setRenaming(sys.id); setRenameValue(sys.name); }}
              >
                Rename
              </button>
              <button
                type="button"
                style={quietLink}
                onClick={async () => { await helpers.setActiveSavedSystem(sys.id); router.push('/'); }}
              >
                Use in conversation
              </button>
              <button
                type="button"
                style={{ ...quietLink, color: EDITORIAL.faint }}
                onClick={() => remove(sys.id, sys.name)}
              >
                Remove
              </button>
            </div>
          </article>
        ))
      )}

      <div style={{ borderTop: systems && systems.length > 0 ? `1px solid ${EDITORIAL.hairline}` : 'none', paddingTop: '2rem', marginTop: '0.5rem' }}>
        <Link href="/" style={quietLink}>＋ Assess another system</Link>
      </div>
    </main>
  );
}

export default function SystemsPage() {
  return (
    <Suspense>
      <MySystemsList />
    </Suspense>
  );
}
