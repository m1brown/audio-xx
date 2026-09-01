/**
 * Freeze a completed conversation assessment into a snapshot.
 *
 * DOCTRINE: reason once -> freeze -> render many times.
 *
 * Called from the conversation once, immediately after the listener has been
 * shown an assessment. Everything downstream — View, Print, Save PDF, Share —
 * reads that frozen value. Nothing re-derives.
 *
 * Best-effort by design. A snapshot that cannot be stored costs the listener
 * the artifact actions for that turn; it must never cost them the assessment
 * they are already reading, so every failure returns null quietly.
 */
import type { AssessmentSnapshotV1 } from '@/lib/artifact/snapshot';
import { freezeSnapshot } from '@/lib/artifact/snapshot';

export async function createArtifactSnapshot(
  snapshot: AssessmentSnapshotV1,
  systemId?: string | null,
): Promise<string | null> {
  try {
    const res = await fetch('/api/assessment-snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot: freezeSnapshot(snapshot), systemId: systemId ?? null }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json?.viewToken === 'string' ? json.viewToken : null;
  } catch {
    return null;
  }
}

/** The explicit Share action. The only thing that grants public access. */
export async function shareArtifactSnapshot(viewToken: string): Promise<string | null> {
  try {
    const res = await fetch('/api/assessment-snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'share', viewToken }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json?.shareToken === 'string' ? json.shareToken : null;
  } catch {
    return null;
  }
}
