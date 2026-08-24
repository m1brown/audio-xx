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
import { snapshotFromCanonical, freezeSnapshot } from '@/lib/artifact/snapshot';

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

/**
 * The identical-reassessment rule (M3, explicit product rule):
 * a new history entry is added ONLY when the assessment actually changed —
 * different engine version, or materially different rendered content.
 * A re-run that differs only by its print date is the same reading and is
 * never silently appended; the caller is told it already exists. This also
 * makes saves idempotent against double-submits and refresh-resubmits.
 */
export function payloadsMateriallyEqual(aJson: string, bJson: string): boolean {
  try {
    const a = JSON.parse(aJson) as Record<string, unknown>;
    const b = JSON.parse(bJson) as Record<string, unknown>;
    // `date` on the legacy payload, `createdAt` on the snapshot: the timestamp
    // is the one field guaranteed to differ between two identical readings,
    // and comparing it would make every re-save look like a changed one.
    delete a.date; delete b.date;
    delete a.createdAt; delete b.createdAt;
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false; // unreadable payloads are never "the same" — allow a fresh save
  }
}

/**
 * Read a stored assessment's summary fields, whichever shape it is in.
 *
 * Rows written before the licensing gate hold an `ArtifactPayload`; rows
 * written since hold a licensed snapshot. Both are readable, and the history
 * list must not stop working for either — a listener's saved assessments are
 * theirs regardless of which format was current when they saved them.
 */
export function storedSummary(payloadJson: string):
{ verdict: string | null; chain: string[] } | null {
  try {
    const raw = JSON.parse(payloadJson) as Record<string, unknown>;
    const verdict = typeof raw.verdict === 'string' ? raw.verdict : null;
    const legacyChain = Array.isArray(raw.componentCredit)
      ? (raw.componentCredit as string[]) : undefined;
    const snapshotChain = Array.isArray(raw.components)
      ? (raw.components as Array<{ name?: string }>)
        .map((c) => c?.name).filter((n): n is string => !!n)
      : undefined;
    return { verdict, chain: legacyChain ?? snapshotChain ?? [] };
  } catch {
    return null;
  }
}

export interface SaveResult {
  systemId: string;
  snapshotId: string;
  /** True when the canonical system already existed for this user. */
  duplicate: boolean;
  /**
   * True when nothing was appended because today's assessment is
   * materially identical to the latest saved one (same engine, same
   * content — only the date would differ). snapshotId is then the
   * EXISTING latest snapshot.
   */
  identical: boolean;
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

  /*
   * Store the LICENSED assessment, not the trait/axis payload.
   *
   * `rendered.payload` is the trait-lane document. Storing it made the saved
   * copy a second authoring lane: a signed-in reader opened a row that had
   * never passed the licensing gate, so authentication decided whether D-7
   * applied. The snapshot carries the licence with it, so every later read
   * renders the same authoritative assessment without re-deriving anything.
   *
   * `findings` travels into the builder for licensing only — it is how the
   * gate learns which relationships the engine established, so a real
   * constraint survives instead of being discarded as unlicensed.
   */
  const licensed = snapshotFromCanonical(rendered.canonical, {
    engineVersion: engineVersion(),
    createdAt: new Date().toISOString(),
    findings: (rendered.raw as { findings?: unknown } | null)?.findings,
  });
  const payloadJson = freezeSnapshot(licensed);
  const version = engineVersion();

  // Identical-reassessment rule: appending happens only when the reading
  // actually changed. Same engine + materially identical content → tell
  // the caller it's already saved, append nothing.
  if (existing) {
    const latest = await db.assessmentSnapshot.findFirst({
      where: { systemId: existing.id },
      orderBy: { createdAt: 'desc' },
    });
    if (latest && latest.engineVersion === version
      && payloadsMateriallyEqual(latest.payloadJson, payloadJson)) {
      return {
        systemId: existing.id,
        snapshotId: latest.id,
        duplicate: true,
        identical: true,
        name: existing.name,
      };
    }
  }

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
      payloadJson,
      engineVersion: version,
    },
  });

  return {
    systemId: system.id,
    snapshotId: snapshot.id,
    duplicate: Boolean(existing),
    identical: false,
    name: system.name,
  };
}

// ── Saved system + assessment history (M3) ───────────────────────────

export interface HistoryEntry {
  id: string;
  savedAt: string;
  engineVersion: string;
  /** Verdict headline, or null when the stored payload is unreadable. */
  verdict: string | null;
  latest: boolean;
  /** False when the payload cannot be parsed — the entry still lists. */
  readable: boolean;
}

export interface SavedSystemDetail {
  id: string;
  name: string;
  notes: string | null;
  canonicalText: string | null;
  chain: string[];
  createdAt: string;
  updatedAt: string;
  history: HistoryEntry[];
}

/**
 * One saved system with its full assessment history, newest first.
 * Ownership-scoped: returns null for another user's system or an
 * unknown id. Corrupted payloads degrade to an unreadable entry
 * instead of breaking the page.
 */
export async function getSavedSystem(
  db: PrismaClient,
  userId: string,
  systemId: string,
): Promise<SavedSystemDetail | null> {
  const system = await db.system.findFirst({
    where: { id: systemId, userId },
    include: {
      assessments: { orderBy: { createdAt: 'desc' } },
      components: { include: { component: { select: { brand: true, name: true } } } },
    },
  });
  if (!system) return null;

  let chain: string[] = [];
  const history: HistoryEntry[] = system.assessments.map((snap, i) => {
    const summary = storedSummary(snap.payloadJson);
    const verdict = summary?.verdict ?? null;
    const readable = !!summary;
    if (chain.length === 0 && summary) chain = summary.chain;
    return {
      id: snap.id,
      savedAt: snap.createdAt.toISOString(),
      engineVersion: snap.engineVersion,
      verdict,
      latest: i === 0,
      readable,
    };
  });

  if (chain.length === 0 && system.components.length > 0) {
    chain = system.components.map((c) => `${c.component.brand} ${c.component.name}`);
  }

  return {
    id: system.id,
    name: system.name,
    notes: system.notes,
    canonicalText: system.canonicalText,
    chain,
    createdAt: system.createdAt.toISOString(),
    updatedAt: system.updatedAt.toISOString(),
    history,
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
      // Corrupted rows show the system without a summary rather than failing.
      const summary = storedSummary(latest.payloadJson);
      chain = summary?.chain ?? [];
      verdict = summary?.verdict ?? null;
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
