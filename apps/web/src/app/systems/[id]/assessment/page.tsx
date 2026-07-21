/**
 * Saved assessment (MVP M2) — the artifact exactly as it was written.
 *
 * Renders the stored AssessmentSnapshot payload — NOT a re-run — so
 * engine evolution never rewrites what the collector saved. A quiet
 * provenance line carries the saved date and engine version, and
 * "Run today's assessment" opens the canonical stateless URL against
 * the current engine for comparison.
 */
import { notFound, redirect } from 'next/navigation';
import AssessmentArtifact from '@/app/artifact/AssessmentArtifact';
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

  let payload: ArtifactPayload;
  try {
    payload = JSON.parse(snapshot.payloadJson) as ArtifactPayload;
  } catch {
    notFound();
  }

  const savedDate = snapshot.createdAt.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const canonicalUrl = system.canonicalText
    ? `/artifact?system=${encodeURIComponent(system.canonicalText)}`
    : null;

  return (
    <>
      <div
        style={{
          textAlign: 'center',
          fontFamily: 'var(--face-grotesque, sans-serif)',
          fontSize: '0.65rem',
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#9E9A93',
          padding: '1.4rem 1rem 0',
        }}
      >
        {system.name} · saved {savedDate} · engine {snapshot.engineVersion}
      </div>
      <AssessmentArtifact p={payload} />
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
      <SnapshotActions canonicalUrl={canonicalUrl} />
    </>
  );
}
