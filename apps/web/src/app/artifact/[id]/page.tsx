/**
 * Canonical artifact — private View / Print.
 *
 *   /artifact/<viewToken>
 *
 * Render-only. It resolves a frozen snapshot and displays it. No recognition,
 * no corroboration, no evidence acquisition, no reasoning — see
 * `snapshot-route-purity.test.ts`, which asserts this file imports nothing that
 * could reassess.
 *
 * `[id]` is the VIEW TOKEN, never the database id. An anonymous listener has no
 * account to authenticate against, so the URL they hold is their claim to the
 * assessment; a cuid would be a weaker secret than that job requires.
 *
 * Not indexed and carries no share metadata: this route is reachable by the
 * person who made the assessment, and printing from it must not publish it.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { readForView } from '@/product/assessment-snapshot';
import { prismaSnapshotPort } from '@/product/snapshot-port-prisma';
import SnapshotArtifact from '../SnapshotArtifact';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'System Assessment',
  robots: { index: false, follow: false },
};

export default async function PrivateArtifactPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const snapshot = await readForView(prismaSnapshotPort, id);
  if (!snapshot) notFound();
  return <SnapshotArtifact snapshot={snapshot} />;
}
