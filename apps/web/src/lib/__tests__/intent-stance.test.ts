/**
 * P1–P5 — Intent gate + intent-relative recommendation surfaces.
 *
 * Locks the launch-critical fix for the universal-"better" bias:
 *   Recommendation = Judgment × User Intent.
 * Intent comes ONLY from desires / listenerPreferenceProfile.
 */
import { describe, it, expect } from 'vitest';
import { deriveIntentStance } from '../preference-protection';
import { createDefaultProfile, applySignals } from '../listener-preferences';
import { buildSystemAssessment } from '../consultation';
import { extractSubjectMatches } from '../intent';

describe('deriveIntentStance (P1 — shared intent gate)', () => {
  it('returns no intent when nothing is provided', () => {
    const s = deriveIntentStance(undefined, undefined);
    expect(s.hasIntent).toBe(false);
    expect(s.warm_bright).toBeNull();
  });

  it('maps a "more warmth" desire to warm_bright=warm', () => {
    const s = deriveIntentStance([{ quality: 'warmth', direction: 'more' }], undefined);
    expect(s.warm_bright).toBe('warm');
    expect(s.hasIntent).toBe(true);
  });

  it('flips a "less" desire to the opposite side', () => {
    const s = deriveIntentStance([{ quality: 'brightness', direction: 'less' }], undefined);
    expect(s.warm_bright).toBe('warm');
  });

  it('maps "more detail" to smooth_detailed=detailed and "more flow" to smooth', () => {
    expect(deriveIntentStance([{ quality: 'detail', direction: 'more' }]).smooth_detailed).toBe('detailed');
    expect(deriveIntentStance([{ quality: 'flow', direction: 'more' }]).smooth_detailed).toBe('smooth');
  });

  it('cancels to null when two explicit desires disagree on one axis', () => {
    const s = deriveIntentStance([
      { quality: 'warmth', direction: 'more' },
      { quality: 'brightness', direction: 'more' },
    ]);
    expect(s.warm_bright).toBeNull();
  });

  it('fills a silent axis from the listener profile when confidence clears the floor', () => {
    // Several "warm/lush" signals push warmth_vs_neutrality below 0.5.
    let p = createDefaultProfile();
    p = applySignals(p, [
      { dimension: 'warmth_vs_neutrality', direction: -0.1, phrase: 'warm', confidence: 'moderate' },
      { dimension: 'warmth_vs_neutrality', direction: -0.1, phrase: 'warm', confidence: 'moderate' },
      { dimension: 'warmth_vs_neutrality', direction: -0.1, phrase: 'warm', confidence: 'moderate' },
    ]);
    const s = deriveIntentStance(undefined, p);
    expect(s.warm_bright).toBe('warm');
  });

  it('never reads system axes — empty desires + default profile yields no intent', () => {
    const s = deriveIntentStance([], createDefaultProfile());
    expect(s.hasIntent).toBe(false);
  });
});

// ── End-to-end: the recommendation surfaces honor intent ──────────────

function assess(system: string[], desires?: Array<{ quality: string; direction: 'more' | 'less' }>) {
  const text = 'Assess my system: ' + system.join(', ');
  const subj = extractSubjectMatches(text);
  const r = buildSystemAssessment(text, subj, null, desires as never);
  if (r?.kind !== 'assessment') throw new Error('no assessment');
  const p1 = r.response.upgradePaths?.[0];
  return { p1, bottleneck: r.response.findings?.bottleneck ?? null, limitations: r.response.assessmentLimitations ?? [] };
}

const WARM = ['Schiit Bifrost 2/64', 'Marantz 2220B', 'JBL L100 Classic'];
const DETAILED = ['Topping D90SE', 'Hegel H190', 'JBL L100 Classic'];

// Doctrine D-11 (Explanatory Licensing) SUPERSEDES the former intent-aware
// bottleneck promotion. A warm system's warmth is intrinsic character, not a
// licensed interaction/constraint/mismatch, so it can never be a primary
// diagnosis — and listener priorities may not create or elevate one. (The
// intent-aware nudge may return later purely as a recommendation-layer
// capability; see POST_LAUNCH.md. It is no longer diagnostic logic.)
describe('P2/P3 — D-11: intent never creates or elevates a primary diagnosis', () => {
  it('A · warm system + wants warmth → no primary bottleneck (character is not a defect)', () => {
    expect(assess(WARM, [{ quality: 'warmth', direction: 'more' }]).bottleneck).toBeNull();
  });

  it('B · warm system + wants detail → still no primary bottleneck (intent cannot create one)', () => {
    expect(assess(WARM, [{ quality: 'detail', direction: 'more' }]).bottleneck).toBeNull();
  });

  it('E · no intent → no primary bottleneck, and intent does not elevate the recommendation impact', () => {
    const none = assess(WARM, undefined);
    expect(none.bottleneck).toBeNull();
    // The former promotion is retired: the upgrade-path impact no longer varies by intent.
    const wantsWarmth = assess(WARM, [{ quality: 'warmth', direction: 'more' }]).p1?.impact;
    const wantsDetail = assess(WARM, [{ quality: 'detail', direction: 'more' }]).p1?.impact;
    expect(wantsWarmth).toBe(none.p1?.impact);
    expect(wantsDetail).toBe(none.p1?.impact);
  });
});

describe('P5 — limitation framing is intent-relative', () => {
  it('C · detailed system + wants detail → resolution limitation reframed as accepted trade-off', () => {
    const { limitations } = assess(DETAILED, [{ quality: 'detail', direction: 'more' }]);
    expect(limitations.some((l) => /the detail you want/i.test(l))).toBe(true);
  });

  it('D · detailed system + wants flow → detail limitation stays a genuine limitation', () => {
    const { limitations } = assess(DETAILED, [{ quality: 'flow', direction: 'more' }]);
    expect(limitations.some((l) => /Resolution repeats at several stages — lesser recordings may sound analytical/i.test(l))).toBe(true);
    expect(limitations.some((l) => /the detail you want/i.test(l))).toBe(false);
  });
});
