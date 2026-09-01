/**
 * Audio XXI — Regression capture (Tier A: deterministic engine snapshot).
 *
 * Turns a fixture into a normalized, stable snapshot of exactly the content the
 * System Assessment renders: the assessment text, the recommendation, the
 * bottleneck, and the upgrade paths. This is captured straight from the engine
 * (`buildSystemAssessment`) rather than scraped from the DOM because:
 *
 *   1. The rendered text is a pure, deterministic function of the engine output
 *      — the only client-side nondeterminism (the optional LLM Character
 *      overlay) is cosmetic and never part of these fields.
 *   2. Engine capture is sub-second and has zero browser flake, so the suite
 *      scales to hundreds of systems.
 *
 * The browser tier (visual-regression.spec.ts) covers what this cannot: that
 * the deterministic content actually renders without layout breakage.
 *
 * Only categorical, order-stable fields are captured. Numeric `_n` axis values
 * and any timestamps are deliberately excluded so the snapshot diffs cleanly.
 */
import { buildSystemAssessment } from '../lib/consultation';
import { extractSubjectMatches } from '../lib/intent';
import type { QaFixture } from './fixtures';

export interface CapturedUpgradePath {
  rank: number;
  label: string;
  impact: string;
  strategyLabel?: string;
  rationale: string;
}

export interface CapturedSnapshot {
  id: string;
  label: string;
  category: string;
  systemText: string;
  desires: QaFixture['desires'];
  /** False when the system text did not resolve to a catalog assessment. */
  resolved: boolean;
  kind: string;
  systemAxes: Record<string, string>;
  bottleneck: { category: string | null; component: string | null } | null;
  signature: string;
  strengths: string[];
  limitations: string[];
  upgradeDirection: string;
  upgradePaths: CapturedUpgradePath[];
  keepRecommendations: Array<{ name: string; reason: string }>;
  recommendedSequence: Array<{ step: number; action: string }>;
  keyObservation: string;
}

/** Keep only the categorical axis leanings (drop numeric `_n` jitter). */
function categoricalAxes(axes: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!axes) return out;
  for (const k of ['warm_bright', 'smooth_detailed', 'elastic_controlled', 'airy_closed']) {
    const v = axes[k];
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

export function captureFixture(fixture: QaFixture): CapturedSnapshot {
  const empty: CapturedSnapshot = {
    id: fixture.id,
    label: fixture.label,
    category: fixture.category,
    systemText: fixture.systemText,
    desires: fixture.desires,
    resolved: false,
    kind: 'unresolved',
    systemAxes: {},
    bottleneck: null,
    signature: '',
    strengths: [],
    limitations: [],
    upgradeDirection: '',
    upgradePaths: [],
    keepRecommendations: [],
    recommendedSequence: [],
    keyObservation: '',
  };

  let r: any;
  try {
    const subjects = extractSubjectMatches(fixture.systemText);
    r = buildSystemAssessment(fixture.systemText, subjects, null, fixture.desires as never);
  } catch (err) {
    return { ...empty, kind: `error: ${(err as Error).message.slice(0, 200)}` };
  }
  if (!r || r.kind !== 'assessment') {
    return { ...empty, kind: r?.kind ?? 'no-result' };
  }

  const f = r.findings ?? {};
  const resp = r.response ?? {};
  const bottleneckCategory = f.bottleneck?.category ?? null;
  const bottleneckComponent =
    resp.primaryConstraint?.componentName ?? f.bottleneck?.componentName ?? null;

  return {
    id: fixture.id,
    label: fixture.label,
    category: fixture.category,
    systemText: fixture.systemText,
    desires: fixture.desires,
    resolved: true,
    kind: r.kind,
    systemAxes: categoricalAxes(f.systemAxes),
    bottleneck:
      bottleneckCategory || bottleneckComponent
        ? { category: bottleneckCategory, component: bottleneckComponent }
        : null,
    signature: resp.systemSignature ?? '',
    strengths: (resp.assessmentStrengths ?? []) as string[],
    limitations: (resp.assessmentLimitations ?? []) as string[],
    upgradeDirection: resp.upgradeDirection ?? '',
    upgradePaths: ((resp.upgradePaths ?? []) as any[]).map((p) => ({
      rank: p.rank,
      label: p.label,
      impact: p.impact,
      strategyLabel: p.strategyLabel,
      rationale: p.rationale,
    })),
    keepRecommendations: ((resp.keepRecommendations ?? []) as any[]).map((k) => ({
      name: k.name,
      reason: k.reason,
    })),
    recommendedSequence: ((resp.recommendedSequence ?? []) as any[]).map((s) => ({
      step: s.step,
      action: s.action,
    })),
    keyObservation: resp.keyObservation ?? '',
  };
}
