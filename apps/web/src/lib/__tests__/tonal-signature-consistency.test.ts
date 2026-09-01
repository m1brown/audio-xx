import { describe, it, expect } from 'vitest';
import { extractSubjectMatches, detectIntent } from '../intent';
import { buildSystemAssessment } from '../consultation';
import { synthesizeArtifact } from '../artifact/synthesizeArtifact';
import { toCanonicalAssessment } from '../artifact/canonical';
import {
  synthesiseSystemAxisNumeric,
  AXIS_BALANCED_BAND,
  type PrimaryAxisLeanings,
} from '../axis-types';

/**
 * Tonal-signature unification lock (founder-reported defect, 2026-08-13).
 *
 * The production FRANCE artifact rendered a Tonal Signature graph asserting
 * {warm, smooth, elastic} while its own standfirst asserted "tonally
 * balanced, detail-forward" — two independent aggregators (categorical
 * winner-takes-all vs numeric weighted average) for one concept, disagreeing
 * on one page.
 *
 * Invariant: the graph plots the SAME role-weighted numeric averages the
 * signature prose reads. A marker may sit left of the balanced band only if
 * the prose side of the same value would also read left, and vice versa.
 */

function franceCanonical() {
  const Q = 'Assess my system: Job integrated, WLM Diva monitor, Eversolo DMP-A6';
  const subs = extractSubjectMatches(Q);
  const { desires } = detectIntent(Q);
  const raw: any = buildSystemAssessment(Q, subs as any, null, desires);
  const { payload } = synthesizeArtifact(raw) as any;
  return { raw, payload, cam: toCanonicalAssessment(payload, raw) as any };
}

describe('tonal signature — one aggregation for graph and prose', () => {
  it('findings carry the shared numeric averages', () => {
    const { raw } = franceCanonical();
    const n = raw?.findings?.systemAxisNumeric;
    expect(n).toBeDefined();
    for (const k of ['warm_bright', 'smooth_detailed', 'elastic_controlled', 'airy_closed']) {
      expect(typeof n[k]).toBe('number');
    }
  });

  it('payload carries the numeric averages for payload-only surfaces', () => {
    const { payload, raw } = franceCanonical();
    expect(payload.systemAxisNumeric).toEqual(raw.findings.systemAxisNumeric);
  });

  it('every graph marker agrees with the numeric value it plots (band + side)', () => {
    const { raw, cam } = franceCanonical();
    const n: Record<string, number> = raw.findings.systemAxisNumeric;
    const readings = cam.identity.tonalSignature as Array<{
      axis: string; pole: string; position: number;
    }>;
    expect(readings?.length).toBe(3);
    for (const r of readings) {
      const v = n[r.axis];
      const expectedPole = v < -AXIS_BALANCED_BAND ? 'left' : v > AXIS_BALANCED_BAND ? 'right' : 'neutral';
      expect(r.pole, `${r.axis}: value ${v}`).toBe(expectedPole);
      const clamped = Math.max(-1.5, Math.min(1.5, v));
      expect(r.position, `${r.axis}: value ${v}`).toBe(Math.round(50 + clamped * 24));
    }
  });

  it('markers are continuous, not pinned to three fixed slots (regression: all dots identical)', () => {
    // A mixed-lean synthetic system must produce at least two distinct
    // positions and no position exactly at a legacy slot unless the math
    // lands there. This guards the "all three dots at 24%" symptom.
    const comps: PrimaryAxisLeanings[] = [
      { warm_bright: 'warm', smooth_detailed: 'detailed', elastic_controlled: 'neutral', airy_closed: 'airy' } as any,
      { warm_bright: 'neutral', smooth_detailed: 'detailed', elastic_controlled: 'elastic', airy_closed: 'neutral' } as any,
      { warm_bright: 'warm', smooth_detailed: 'smooth', elastic_controlled: 'neutral', airy_closed: 'airy' } as any,
    ];
    const n = synthesiseSystemAxisNumeric(comps, ['speakers', 'dac', 'amplifier']);
    const positions = ['warm_bright', 'smooth_detailed', 'elastic_controlled'].map((k) => {
      const clamped = Math.max(-1.5, Math.min(1.5, (n as any)[k]));
      return Math.round(50 + clamped * 24);
    });
    expect(new Set(positions).size).toBeGreaterThan(1);
  });

  it('signature prose adjectives agree with the shared numeric (no contradiction)', () => {
    const { raw, payload } = franceCanonical();
    const n: Record<string, number> = raw.findings.systemAxisNumeric;
    const signature: string = (payload.signature ?? '').toLowerCase();
    if (!signature) return; // signature is optional; the invariant applies when present
    // warm_bright: "tonally warm" ⇒ value below band; "bright" ⇒ above; "tonally balanced" ⇒ within
    if (signature.includes('tonally warm')) expect(n.warm_bright).toBeLessThan(-AXIS_BALANCED_BAND);
    if (signature.includes('tonally balanced')) {
      expect(Math.abs(n.warm_bright)).toBeLessThanOrEqual(AXIS_BALANCED_BAND);
    }
    if (signature.includes('detail-forward')) expect(n.smooth_detailed).toBeGreaterThan(AXIS_BALANCED_BAND);
    if (signature.includes('elastically flowing')) expect(n.elastic_controlled).toBeLessThan(-AXIS_BALANCED_BAND);
  });
});
