/**
 * Save System — persistence logic for My Systems (MVP M2).
 *
 * The assessment URL remains the canonical identity of a system; saving
 * adds persistence, metadata, and history AROUND that canonical text:
 *
 *   System              one row per canonical system per user
 *   AssessmentSnapshot  immutable record of the assessment as rendered,
 *                       appended on every save/re-save — engine evolution
 *                       never rewrites history
 *
 * Duplicate handling: saving the same canonical text again does not
 * create a second System — it appends a fresh snapshot to the existing
 * one and bumps updatedAt.
 *
 * All functions take the Prisma client as a parameter so the product
 * test suite can run them against a throwaway SQLite database.
 */
import type { PrismaClient } from '@prisma/client';
import type { ArtifactPayload } from '@/lib/artifact/types';
import { runArtifactPipeline, engineVersion } from './assessment-pipeline';

/** Canonical identity: whitespace-collapsed, case preserved. */
export function normalizeSystemText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/** Default collection name — the component credit line, kept short. */
export function deriveSystemName(payload: ArtifactPayload): string {
  const credit = (payload.componentCredit ?? []).filter(Boolean);
  if (credit.length === 0) return 'My System';
  const joined = credit.join(' · ');
  return joined.length <= 72 ? joined : `${credit[0]} · … · ${credit[credit.length - 1]}`;
}

export class SaveError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export interface SaveResult {
  systemId: string;
  snapshotId: string;
  /** True when the canonical system already existed for this user. */
  duplicate: boolean;
  name: string;
}

export async function saveAssessment(
  db: PrismaClient,
  userId: string,
  input: { systemText: string; name?: string; notes?: string },
): Promise<SaveResult> {
  const canonical = normalizeSystemText(input.systemText ?? '');
  if (!canonical) throw new SaveError('A system description is required.', 400);

  // Recompute server-side — the snapshot must be what the engine says,
  // not what a client claims.
  const rendered = runArtifactPipeline(canonical);
  if (!rendered) {
    throw new SaveError('That text does not resolve to an assessment (it needs at least two named components).', 422);
  }

  const existing = await db.system.findFirst({
    where: { userId, canonicalText: canonical },
  });

  const name = input.name?.trim() || deriveSystemName(rendered.payload);

  const system = existing
    ? await db.system.update({
        where: { id: existing.id },
        // A re-save never renames or overwrites the user's notes.
        data: { updatedAt: new Date() },
      })
    : await db.system.create({
        data: {
          userId,
          name,
          notes: input.notes?.trim() || null,
          canonicalText: canonical,
        },
      });

  const snapshot = await db.assessmentSnapshot.create({
    data: {
      systemId: system.id,
      userId,
      systemText: canonical,
      payloadJson: JSON.stringify(rendered.payload),
      engineVersion: engineVersion(),
    },
  });

  return {
    systemId: system.id,
    snapshotId: snapshot.id,
    duplicate: Boolean(existing),
    name: system.name,
  };
}

export interface MySystemSummary {
  id: string;
  name: string;
  notes: string | null;
  chain: string[];
  verdict: string | null;
  assessedAt: string | null;
  engineVersion: string | null;
  createdAt: string;
  updatedAt: string;
  canonicalText: string | null;
  snapshotCount: number;
}

/** The collection, newest first, each with its latest snapshot summary. */
export async function listMySystems(db: PrismaClient, userId: string): Promise<MySystemSummary[]> {
  const systems = await db.system.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      assessments: { orderBy: { createdAt: 'desc' } },
      components: { include: { component: { select: { brand: true, name: true } } } },
    },
  });

  return systems.map((s) => {
    const latest = s.assessments[0] ?? null;
    let chain: string[] = [];
    let verdict: string | null = null;
    if (latest) {
      try {
        const p = JSON.parse(latest.payloadJson) as ArtifactPayload;
        chain = p.componentCredit ?? [];
        verdict = p.verdict ?? null;
      } catch { /* corrupted payload — show the system without a summary */ }
    }
    if (chain.length === 0 && s.components.length > 0) {
      // Systems saved before M2 have component rows instead of snapshots.
      chain = s.components.map((c) => `${c.component.brand} ${c.component.name}`);
    }
    return {
      id: s.id,
      name: s.name,
      notes: s.notes,
      chain,
      verdict,
      assessedAt: latest ? latest.createdAt.toISOString() : null,
      engineVersion: latest?.engineVersion ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      canonicalText: s.canonicalText,
      snapshotCount: s.assessments.length,
    };
  });
}
