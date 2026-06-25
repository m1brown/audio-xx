/**
 * Audio XXI — Regression diff (Tier A comparison).
 *
 * Pure functions that compare a current snapshot against its baseline and
 * surface ONLY meaningful field-level changes, grouped into the four review
 * buckets the report cares about:
 *
 *   assessment      — systemAxes, signature, strengths, limitations, keyObservation
 *   bottleneck      — detected constraint (category + component)
 *   recommendation  — upgradeDirection, keepRecommendations, recommendedSequence
 *   upgradePaths    — the ranked upgrade paths (impact / label / strategy / rationale)
 *
 * No AI, no fuzzy matching: exact structural comparison. A field is "changed"
 * iff its canonical JSON differs. This keeps the signal reproducible and the
 * report small — unchanged fixtures never appear.
 */
import type { CapturedSnapshot } from './capture';

export type DiffCategory = 'assessment' | 'bottleneck' | 'recommendation' | 'upgradePaths';

export interface FieldDiff {
  category: DiffCategory;
  field: string;
  before: unknown;
  after: unknown;
}

export interface FixtureDiff {
  id: string;
  label: string;
  status: 'changed' | 'new' | 'removed' | 'resolution';
  /** Populated for status === 'changed'. */
  diffs: FieldDiff[];
  /** Populated for status === 'resolution'. */
  resolutionNote?: string;
}

const FIELD_CATEGORY: Array<{ field: keyof CapturedSnapshot; category: DiffCategory }> = [
  { field: 'systemAxes', category: 'assessment' },
  { field: 'signature', category: 'assessment' },
  { field: 'strengths', category: 'assessment' },
  { field: 'limitations', category: 'assessment' },
  { field: 'keyObservation', category: 'assessment' },
  { field: 'bottleneck', category: 'bottleneck' },
  { field: 'upgradeDirection', category: 'recommendation' },
  { field: 'keepRecommendations', category: 'recommendation' },
  { field: 'recommendedSequence', category: 'recommendation' },
  { field: 'upgradePaths', category: 'upgradePaths' },
];

function canon(v: unknown): string {
  return JSON.stringify(v ?? null);
}

/** Compare one current snapshot to its baseline (may be undefined → new). */
export function diffSnapshot(
  baseline: CapturedSnapshot | undefined,
  current: CapturedSnapshot,
): FixtureDiff | null {
  if (!baseline) {
    return { id: current.id, label: current.label, status: 'new', diffs: [] };
  }
  // Resolution flips are always meaningful (a system stopped resolving, or
  // started resolving) — report them prominently rather than as field noise.
  if (baseline.resolved !== current.resolved) {
    return {
      id: current.id,
      label: current.label,
      status: 'resolution',
      diffs: [],
      resolutionNote: `resolved ${baseline.resolved} → ${current.resolved} (kind: ${baseline.kind} → ${current.kind})`,
    };
  }

  const diffs: FieldDiff[] = [];
  for (const { field, category } of FIELD_CATEGORY) {
    const b = (baseline as unknown as Record<string, unknown>)[field];
    const c = (current as unknown as Record<string, unknown>)[field];
    if (canon(b) !== canon(c)) {
      diffs.push({ category, field, before: b, after: c });
    }
  }
  if (diffs.length === 0) return null;
  return { id: current.id, label: current.label, status: 'changed', diffs };
}

export interface RegressionReport {
  changed: FixtureDiff[];
  new: FixtureDiff[];
  removed: FixtureDiff[];
  resolution: FixtureDiff[];
  totalFixtures: number;
  unchanged: number;
}

export function buildReport(
  baselines: Map<string, CapturedSnapshot>,
  current: CapturedSnapshot[],
): RegressionReport {
  const changed: FixtureDiff[] = [];
  const created: FixtureDiff[] = [];
  const resolution: FixtureDiff[] = [];
  const seen = new Set<string>();
  let unchanged = 0;

  for (const snap of current) {
    seen.add(snap.id);
    const d = diffSnapshot(baselines.get(snap.id), snap);
    if (!d) { unchanged++; continue; }
    if (d.status === 'new') created.push(d);
    else if (d.status === 'resolution') resolution.push(d);
    else changed.push(d);
  }

  const removed: FixtureDiff[] = [];
  for (const [id, base] of baselines) {
    if (!seen.has(id)) {
      removed.push({ id, label: base.label, status: 'removed', diffs: [] });
    }
  }

  return {
    changed,
    new: created,
    removed,
    resolution,
    totalFixtures: current.length,
    unchanged,
  };
}
