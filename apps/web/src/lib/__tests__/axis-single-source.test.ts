import { describe, it, expect } from 'vitest';
import { buildSystemAssessment } from '@/lib/consultation';
import { extractSubjectMatches, detectIntent } from '@/lib/intent';
import { synthesizeArtifact } from '@/lib/artifact/synthesizeArtifact';
import { toCanonicalAssessment } from '@/lib/artifact/canonical';
import { deriveIdentity } from '@/lib/a3-artifact-case';
import { poleFor, committedValue, classifyAxis, BALANCED_BAND } from '@/lib/axis-poles';

/**
 * ONE AXIS, ONE VALUE.
 *
 * FRANCE reported the same axis three ways on one page:
 *   Recognition   "with detail held back from the front"   (categorical 'smooth')
 *   Graph         "Balanced"                                (numeric +0.1)
 *   Engineering   "2 of the 3 components lean the same way (detailed)"
 *
 * Recognition and Engineering stated opposites. Every surface now derives its
 * system-level pole from `systemAxisNumeric` through the same thresholds.
 */

const FRANCE = 'Assess my system: Job integrated, WLM Diva monitor, Eversolo DMP-A6';
const run = (q: string) => {
  const r = buildSystemAssessment(q, extractSubjectMatches(q), null, detectIntent(q).desires);
  return r as unknown as { findings: Record<string, unknown> };
};

describe('FRANCE regression — the authoritative values', () => {
  const raw = run(FRANCE);
  const numeric = raw.findings.systemAxisNumeric as Record<string, number>;

  it('smooth_detailed aggregates INSIDE the balanced band', () => {
    expect(numeric.smooth_detailed).toBeCloseTo(0.1, 5);
    expect(Math.abs(numeric.smooth_detailed)).toBeLessThan(BALANCED_BAND);
    expect(poleFor(numeric.smooth_detailed)).toBe('neutral');
    expect(committedValue('smooth_detailed', numeric)).toBeUndefined();
  });

  it('the graph reads Balanced on that axis', () => {
    const cam = toCanonicalAssessment(synthesizeArtifact(raw).payload, raw);
    const axis = cam.identity.tonalSignature?.find((a) => a.axis === 'smooth_detailed');
    expect(axis?.pole).toBe('neutral');
  });

  it('RECOGNITION does not say smooth, or detailed, or anything on that axis', () => {
    const { payload } = synthesizeArtifact(raw);
    expect(payload.recognition).not.toMatch(/smooth|detail|resolution/i);
    // It still reports the axes the system HAS committed to.
    expect(payload.recognition).toMatch(/rhythmically elastic/);
    expect(payload.recognition).toMatch(/tonal weight/);
  });

  it('identity agrees with the graph', () => {
    const id = deriveIdentity(raw);
    expect(id.committedAxes.smooth_detailed).toBeUndefined();
    expect(id.committedAxes.elastic_controlled).toBe('elastic');
    expect(id.committedAxes.warm_bright).toBe('warm');
  });

  it('ENGINEERING calls the split a split, not agreement', () => {
    const { payload } = synthesizeArtifact(raw);
    const prose = payload.caseParagraphs.join(' ');
    expect(prose).not.toMatch(/lean the same way \(detailed\)/);
    expect(prose).not.toMatch(/That agreement is what a coherent system sounds like/);
    expect(prose).toMatch(/do not all lean the\s+same way/);
    // And it names both sides rather than counting a majority.
    expect(prose).toMatch(/WLM Diva Monitor/);
    expect(prose).toMatch(/not established/);
  });

  it('NO OTHER Engineering sentence asserts uniform agreement', () => {
    // Two closing sentences bracketed the split paragraph on production:
    // "Nothing upstream works against the speaker's own behaviour" before it
    // and "Each stage carries the same character forward" after. Both claim
    // the agreement the middle paragraph had just denied.
    const prose = synthesizeArtifact(raw).payload.caseParagraphs.join(' ');
    expect(prose).not.toMatch(/Each stage carries the same character forward/);
    expect(prose).not.toMatch(/Nothing upstream works against the speaker/);
    expect(prose).not.toMatch(/every stage in the chain leans toward/);
  });
});

describe('NO SURFACE MAY CONTRADICT THE GRAPH', () => {
  const systems = [
    FRANCE,
    'Assess my system: Amp: Leben CS600 Speakers: Klipsch Cornwall IV',
    'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, WLM Diva Monitor',
    'Assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus',
  ];

  for (const q of systems) {
    it(`holds for: ${q.slice(19, 58)}`, () => {
      const raw = run(q);
      const numeric = raw.findings.systemAxisNumeric as Record<string, number>;
      const { payload } = synthesizeArtifact(raw);
      const cam = toCanonicalAssessment(payload, raw);

      for (const axis of ['warm_bright', 'smooth_detailed', 'elastic_controlled']) {
        const graph = cam.identity.tonalSignature?.find((a) => a.axis === axis);
        expect(graph?.pole, axis).toBe(poleFor(numeric[axis]));

        // Where the graph says neutral, NO prose surface may name either pole
        // of that axis as a system-level claim.
        if (graph?.pole !== 'neutral') continue;
        const poles = { warm_bright: /\bwarm|\bbright/i,
          smooth_detailed: /\bsmooth|\bdetail|resolution/i,
          elastic_controlled: /\belastic|\bcontrolled|dynamic grip/i }[axis]!;
        expect(payload.recognition ?? '', `${axis} in recognition of ${q}`).not.toMatch(poles);
      }
    });
  }

  it('a genuinely agreeing system KEEPS its agreement prose', () => {
    // The positive control. Suppressing agreement everywhere would be the
    // over-correction; the claim must survive where the field supports it.
    const raw = run('Assess my system: Amp: Leben CS600 Speakers: Klipsch Cornwall IV');
    const prose = synthesizeArtifact(raw).payload.caseParagraphs.join(' ');
    expect(prose).toMatch(/lean the same way|carries that direction forward|character forward/);
  });

  it('identity and the rendered payload never disagree', () => {
    for (const q of systems) {
      const raw = run(q);
      const id = deriveIdentity(raw);
      const { payload } = synthesizeArtifact(raw);
      expect(id.recognition, q).toBe(payload.recognition);
      expect(id.verdict, q).toBe(payload.verdict);
    }
  });
});

describe('agreement, split and insufficient are different findings', () => {
  const per = (rows: Array<[string, string]>) =>
    rows.map(([name, v]) => ({ name, axes: { smooth_detailed: v } }));

  it('every component leaning one way is agreement', () => {
    expect(classifyAxis('smooth_detailed', per([['A', 'detailed'], ['B', 'detailed']])))
      .toEqual({ kind: 'agreement', side: 'detailed', count: 2 });
  });

  it('a majority is NOT agreement', () => {
    // The FRANCE shape: two sources detailed, the loudspeaker smooth.
    const r = classifyAxis('smooth_detailed',
      per([['A', 'detailed'], ['B', 'detailed'], ['Speaker', 'smooth']]));
    expect(r.kind).toBe('split');
    if (r.kind !== 'split') return;
    expect(r.sides[0].components).toHaveLength(2);
    expect(r.sides[1].components).toEqual(['Speaker']);
  });

  it('fewer than two readings is insufficient, not agreement', () => {
    expect(classifyAxis('smooth_detailed', per([['A', 'detailed']])).kind).toBe('insufficient');
    expect(classifyAxis('smooth_detailed', per([['A', 'neutral'], ['B', 'neutral']])).kind)
      .toBe('insufficient');
  });
});
