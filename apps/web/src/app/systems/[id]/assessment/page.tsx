/**
 * Saved assessment (M2, extended in M3) — the artifact exactly as it
 * was written.
 *
 * Renders the stored snapshot payload — NOT a re-run — so engine
 * evolution never rewrites what the collector saved. The provenance
 * line states whether this is the LATEST or an EARLIER assessment,
 * with its saved date and engine version. `?snap=` opens any entry
 * from the system's history. A corrupted payload degrades to an
 * editorial notice with the history still reachable — it never blocks
 * the rest of the system.
 */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import AssessmentArtifact from '@/app/artifact/AssessmentArtifact';
import SnapshotArtifact from '@/app/artifact/SnapshotArtifact';
import { toCanonicalAssessment } from '@/lib/artifact/canonical';
import { snapshotFromCanonical, parseSnapshot } from '@/lib/artifact/snapshot';
import SnapshotActions from './SnapshotActions';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/session';
import type { ArtifactPayload } from '@/lib/artifact/types';

export const dynamic = 'force-dynamic';

export default async function SavedAssessmentPage(
  { params, searchParams }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ snap?: string }>;
  },
) {
  const userId = await getUserId();
  if (!userId) redirect('/auth/signin');
  const { id } = await params;
  const { snap } = await searchParams;

  let system;
  try {
    system = await prisma.system.findFirst({
      where: { id, userId },
      include: { assessments: { orderBy: { createdAt: 'desc' } } },
    });
  } catch {
    system = null;
  }
  if (!system || system.assessments.length === 0) notFound();

  const snapshot = (snap && system.assessments.find((a) => a.id === snap)) || system.assessments[0];
  const isLatest = snapshot.id === system.assessments[0].id;

  const savedDate = snapshot.createdAt.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const canonicalUrl = system.canonicalText
    ? `/artifact?system=${encodeURIComponent(system.canonicalText)}`
    : null;

  const provenance = (
    <div
      style={{
        textAlign: 'center',
        fontFamily: 'var(--face-grotesque, sans-serif)',
        fontSize: '0.65rem',
        fontWeight: 600,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: isLatest ? '#9E9A93' : '#A8231B',
        padding: '1.4rem 1rem 0',
      }}
    >
      {system.name} · {isLatest ? 'latest assessment' : 'earlier assessment'} · saved {savedDate} · engine {snapshot.engineVersion}
    </div>
  );

  /*
   * A SIGNED-IN READER GETS THE SAME ASSESSMENT AS EVERYONE ELSE.
   *
   * This page rendered the stored ArtifactPayload — the TRAIT/AXIS lane —
   * so authentication decided which epistemic path a listener was on. Rows
   * written before the licensing gate carry claims nothing licensed, and
   * rendering them unchanged republishes those claims today.
   *
   * Two stored shapes, one rendered result. A row written since the gate is
   * already a licensed snapshot and renders as it is. A legacy payload row is
   * put through the gate on read, which fails CLOSED: with no `findings` to
   * show what the engine established, trait prose is withheld. That is the
   * correct direction — it withholds claims rather than inventing them — and
   * it is not reassessment: no new claim is produced, only unlicensed ones
   * withdrawn.
   */
  const stored = parseSnapshot(snapshot.payloadJson);
  let payload: ArtifactPayload | null = null;
  try {
    payload = JSON.parse(snapshot.payloadJson) as ArtifactPayload;
  } catch {
    payload = null;
  }

  if (!payload) {
    // Corrupted history entry — say so plainly, keep the system reachable.
    return (
      <>
        {provenance}
        <section className="axx-followup" aria-label="Notice">
          <p>
            This saved assessment can no longer be displayed. The rest of
            “{system.name}” — including its other assessments — is unaffected.
          </p>
          <p>
            <Link href={`/systems/${system.id}`}>Back to the system and its history →</Link>
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      {provenance}
      {!isLatest && (
        <p
          style={{
            textAlign: 'center',
            fontFamily: 'var(--face-text, serif)',
            fontStyle: 'italic',
            fontSize: '0.9rem',
            color: '#6B6862',
            margin: '0.5rem auto 0',
            maxWidth: '34rem',
            padding: '0 1rem',
          }}
        >
          You are reading an earlier assessment, kept exactly as it was written.
          A newer assessment of this system exists.{' '}
          <Link href={`/systems/${system.id}/assessment`} style={{ color: '#1B1A18' }}>
            Read the latest →
          </Link>
        </p>
      )}
      {stored
        ? <SnapshotArtifact snapshot={stored} />
        : <SnapshotArtifact snapshot={snapshotFromCanonical(
          toCanonicalAssessment(payload, undefined as never),
          { engineVersion: snapshot.engineVersion ?? 'legacy', createdAt: new Date(snapshot.createdAt).toISOString() },
        )} />}
      {system.notes && (
        <p
          style={{
            textAlign: 'center',
            fontFamily: 'var(--face-text, serif)',
            fontStyle: 'italic',
            fontSize: '0.95rem',
            color: '#6B6862',
            maxWidth: '34rem',
            margin: '0 auto',
            padding: '0 1rem',
          }}
        >
          {system.notes}
        </p>
      )}
      <SnapshotActions systemId={system.id} canonicalUrl={isLatest ? canonicalUrl : null} />
    </>
  );
}
