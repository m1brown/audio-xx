/**
 * Public artifact — resolves ONLY through a share token.
 *
 *   /artifact/s/<shareToken>
 *
 * A snapshot that was created and printed but never shared is unreachable
 * here, even by someone holding its view token. `readForShare` requires a
 * minted `shareToken`, so public access exists only where the listener
 * explicitly asked for it.
 *
 * Render-only, on the same terms as the private route.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { readForShare } from '@/product/assessment-snapshot';
import { prismaSnapshotPort } from '@/product/snapshot-port-prisma';
import SnapshotArtifact from '../../SnapshotArtifact';

export const dynamic = 'force-dynamic';

/** Unfurls as the assessment itself — read from the snapshot, never re-derived. */
export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> },
): Promise<Metadata> {
  const { token } = await params;
  const s = await readForShare(prismaSnapshotPort, token);
  if (!s) return { title: 'System Assessment' };
  const title = s.verdict.replace(/\.\s*$/, '').slice(0, 120);
  return {
    title,
    description: [s.standfirst, s.components.map((c) => c.name).join(' · ')]
      .filter(Boolean).join(' — ').slice(0, 200),
    openGraph: { title: `${title} — Audio XX System Assessment`, type: 'article' },
  };
}

export default async function SharedArtifactPage(
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const snapshot = await readForShare(prismaSnapshotPort, token);
  if (!snapshot) notFound();
  return <SnapshotArtifact snapshot={snapshot} />;
}
