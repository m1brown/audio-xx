/**
 * Saved system (M3) — one enduring collection entry, with its
 * assessment history.
 *
 * The distinction this page keeps sharp: the SYSTEM is the user's
 * lasting entry (name, chain, notes); each ASSESSMENT is a dated
 * reading of it at a particular moment and engine version. The latest
 * assessment leads; earlier assessments remain one quiet list below,
 * each opening exactly as it was originally saved.
 */
import React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/session';
import { getSavedSystem } from '@/product/save-system';
import SystemMeta from './SystemMeta';

export const dynamic = 'force-dynamic';

const INK = '#1B1A18';
const MUTED = '#6B6862';
const FAINT = '#9E9A93';
const HAIRLINE = 'rgba(27, 26, 24, 0.14)';
const ACCENT = '#A8231B';

const caps: React.CSSProperties = {
  fontFamily: 'var(--face-grotesque)',
  fontSize: '0.65rem',
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: MUTED,
};

const quietLink: React.CSSProperties = {
  ...caps,
  color: MUTED,
  borderBottom: `1px solid ${HAIRLINE}`,
  paddingBottom: '1px',
  textDecoration: 'none',
};

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function SavedSystemPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect('/auth/signin');
  const { id } = await params;

  let system;
  try {
    system = await getSavedSystem(prisma, userId, id);
  } catch {
    system = null;
  }
  if (!system) notFound();

  const latest = system.history[0] ?? null;
  const earlier = system.history.slice(1);
  const runTodayUrl = system.canonicalText
    ? `/artifact?system=${encodeURIComponent(system.canonicalText)}`
    : null;

  return (
    <main style={{ maxWidth: '42rem', margin: '0 auto', padding: '3.5rem 1.25rem 6rem' }}>
      <Link href="/systems" style={quietLink}>← My Systems</Link>

      <div style={{ marginTop: '2.2rem' }}>
        <SystemMeta id={system.id} name={system.name} notes={system.notes} />
      </div>

      {system.chain.length > 0 && (
        <p style={{ fontFamily: 'var(--face-text)', fontSize: '1rem', color: MUTED, margin: '1.1rem 0 0', overflowWrap: 'anywhere' }}>
          {system.chain.join(' · ')}
        </p>
      )}
      <p style={{ ...caps, color: FAINT, marginTop: '0.8rem' }}>
        In your collection since {longDate(system.createdAt)}
      </p>

      {/* ── Latest assessment — visual priority ── */}
      {latest ? (
        <section style={{ borderTop: `2px solid ${INK}`, marginTop: '2.6rem', paddingTop: '1.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ ...caps, color: ACCENT }}>Latest assessment</span>
            <span style={{ ...caps, color: FAINT }}>
              Saved on {longDate(latest.savedAt)} · engine {latest.engineVersion}
            </span>
          </div>
          {latest.readable ? (
            <>
              <p style={{ fontFamily: 'var(--face-display, var(--face-text))', fontSize: '1.7rem', lineHeight: 1.25, color: INK, margin: '0.9rem 0 0' }}>
                {latest.verdict}
              </p>
              <div style={{ display: 'flex', gap: '1.6rem', flexWrap: 'wrap', marginTop: '1.2rem' }}>
                <Link href={`/systems/${system.id}/assessment`} style={{ ...quietLink, color: INK, borderBottomColor: INK }}>
                  Read the full assessment
                </Link>
                {runTodayUrl && (
                  <Link href={runTodayUrl} style={quietLink}>
                    Run today&rsquo;s assessment
                  </Link>
                )}
              </div>
            </>
          ) : (
            <p style={{ fontFamily: 'var(--face-text)', fontStyle: 'italic', color: MUTED, margin: '0.9rem 0 0' }}>
              This assessment can no longer be displayed.
              {runTodayUrl && (
                <> <Link href={runTodayUrl} style={{ color: INK }}>Run today&rsquo;s assessment →</Link></>
              )}
            </p>
          )}
        </section>
      ) : (
        <section style={{ borderTop: `1px solid ${HAIRLINE}`, marginTop: '2.6rem', paddingTop: '1.4rem' }}>
          <p style={{ fontFamily: 'var(--face-text)', fontStyle: 'italic', color: MUTED, margin: 0 }}>
            This system predates assessment history — no saved assessments yet.
            {runTodayUrl && (
              <> <Link href={runTodayUrl} style={{ color: INK }}>Run its first assessment →</Link></>
            )}
          </p>
        </section>
      )}

      {/* ── Assessment history ── */}
      {earlier.length > 0 && (
        <section style={{ marginTop: '3rem' }}>
          <div style={{ ...caps, marginBottom: '0.4rem' }}>
            Assessment history · {system.history.length} assessments
          </div>
          {earlier.map((entry) => (
            <div
              key={entry.id}
              style={{ borderTop: `1px solid ${HAIRLINE}`, padding: '1.1rem 0 1.2rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ ...caps, color: FAINT }}>Earlier assessment</span>
                <span style={{ ...caps, color: FAINT }}>
                  Saved on {longDate(entry.savedAt)} · engine {entry.engineVersion}
                </span>
              </div>
              {entry.readable ? (
                <>
                  <p style={{ fontFamily: 'var(--face-text)', fontStyle: 'italic', fontSize: '1.02rem', color: INK, margin: '0.55rem 0 0' }}>
                    “{entry.verdict}”
                  </p>
                  <div style={{ marginTop: '0.7rem' }}>
                    <Link href={`/systems/${system.id}/assessment?snap=${entry.id}`} style={quietLink}>
                      Read this assessment
                    </Link>
                  </div>
                </>
              ) : (
                <p style={{ fontFamily: 'var(--face-text)', fontStyle: 'italic', fontSize: '0.95rem', color: FAINT, margin: '0.55rem 0 0' }}>
                  This earlier assessment can no longer be displayed. The rest of the history is unaffected.
                </p>
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
