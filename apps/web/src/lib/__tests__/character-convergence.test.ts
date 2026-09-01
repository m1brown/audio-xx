import { describe, it, expect } from 'vitest';
import { buildSystemAssessment } from '@/lib/consultation';
import { extractSubjectMatches, detectIntent } from '@/lib/intent';
import { synthesizeArtifact } from '@/lib/artifact/synthesizeArtifact';
import { toCanonicalAssessment } from '@/lib/artifact/canonical';
import { deriveIdentity } from '@/lib/a3-artifact-case';

/**
 * ONE CONSTRAINED CHARACTER STATE, MANY RENDERERS.
 *
 * The Magnepan control withheld `smooth_detailed` and `elastic_controlled`
 * from Recognition — correctly, a power mismatch means the system does not
 * operate as its parts suggest — and then plotted "Detailed / Controlled" on
 * the Tonal Signature graph directly beneath it. A graph is a Describe claim
 * about system character and may not publish an axis the same evidence state
 * forbids Recognition to publish.
 */
const run = (q: string) => buildSystemAssessment(
  q, extractSubjectMatches(q), null, detectIntent(q).desires) as any;

const surfaces = (q: string) => {
  const raw = run(q);
  const { payload } = synthesizeArtifact(raw);
  const cam = toCanonicalAssessment(payload, raw);
  const id = deriveIdentity(raw);
  return { raw, payload, cam, id,
    // Every surface that asserts system character, in one place.
    text: [payload.recognition, payload.standfirst, id.recognition,
      JSON.stringify(id.committedAxes)].filter(Boolean).join(' '),
    graphAxes: (cam.identity.tonalSignature ?? []).map((a) => a.axis) };
};

const MAGNEPAN = 'Assess my system: Amp: Zorblax ZX1 5 watt SET Speakers: Magnepan LRS+';
const FRANCE = 'Assess my system: Job integrated, WLM Diva monitor, Eversolo DMP-A6';
const LEBEN = 'Assess my system: Amp: Leben CS600 Speakers: Klipsch Cornwall IV';

describe('MAGNEPAN — a constrained axis cannot reappear through any renderer', () => {
  const s = surfaces(MAGNEPAN);

  it('the constraint is diagnosed', () => {
    expect(s.raw.findings.bottleneck?.category).toBe('power_match');
    expect(s.payload.verdict).toMatch(/can't drive these speakers|need more power/);
  });

  it('withholds the governed axes from the GRAPH', () => {
    expect(s.graphAxes).not.toContain('smooth_detailed');
    expect(s.graphAxes).not.toContain('elastic_controlled');
  });

  it('withholds them from every prose character surface', () => {
    expect(s.payload.recognition).toBe('');
    expect(s.text).not.toMatch(/detailed|resolution|controlled|dynamic grip/i);
  });

  it('leaves the unaffected axis alone', () => {
    // A power mismatch says nothing about tonal balance.
    expect(s.graphAxes).toContain('warm_bright');
  });

  it('never publishes a Listening Session prediction', () => {
    expect(s.cam.reading.listeningSession).toEqual([]);
  });
});

describe('FRANCE — unconstrained character is untouched', () => {
  const s = surfaces(FRANCE);

  it('keeps all three axes on the graph', () => {
    expect(s.graphAxes).toEqual(['warm_bright', 'smooth_detailed', 'elastic_controlled']);
  });

  it('reads Warm / Balanced / Elastic', () => {
    const poles = Object.fromEntries(
      (s.cam.identity.tonalSignature ?? []).map((a) => [a.axis, a.pole]));
    expect(poles.warm_bright).toBe('left');
    expect(poles.smooth_detailed).toBe('neutral');
    expect(poles.elastic_controlled).toBe('left');
  });

  it('keeps Recognition, and keeps it silent on smooth/detailed', () => {
    expect(s.payload.recognition).toBe('This system reads rhythmically elastic, with tonal weight.');
    expect(s.payload.recognition).not.toMatch(/smooth|detail|resolution/i);
  });

  it('keeps the split-field Engineering finding', () => {
    const prose = s.payload.caseParagraphs.join(' ');
    expect(prose).toMatch(/do not all lean the\s+same way/);
    expect(prose).toMatch(/not established/);
  });
});

describe('LEBEN / CORNWALL — coherent character keeps its full richness', () => {
  const s = surfaces(LEBEN);

  it('retains all three axes and a Recognition line', () => {
    expect(s.graphAxes).toHaveLength(3);
    expect(s.payload.recognition).toMatch(/^This system reads /);
  });

  it('publishes no Listening Session — the richness was never licensed', () => {
    /*
     * Superseded 2026-08-24. This asserted that a "coherent character keeps
     * its full richness", and the richness was two paragraphs chosen from
     * three hard-coded openings by reading a catalog axis label.
     *
     * Production settled it: this exact system published "leading edges are
     * clean and quick, and the image extends wide without being pushed
     * forward" while Audio XX held ZERO manufacturer facts for the Leben and
     * no listening evidence for either component. Coherent axes are not
     * evidence about what a listener will hear.
     */
    expect(s.cam.reading.listeningSession).toEqual([]);
  });
});

describe('the graph and Recognition can never disagree', () => {
  for (const q of [MAGNEPAN, FRANCE, LEBEN]) {
    it(`holds for ${q.slice(19, 55)}`, () => {
      const s = surfaces(q);
      for (const axis of ['warm_bright', 'smooth_detailed', 'elastic_controlled']) {
        const onGraph = s.graphAxes.includes(axis);
        if (onGraph) continue;
        // An axis absent from the graph must be absent from prose too.
        const words = { warm_bright: /\bwarm\b|\bbright\b/i,
          smooth_detailed: /\bsmooth\b|\bdetail|resolution/i,
          elastic_controlled: /\belastic\b|\bcontrolled\b|dynamic grip/i }[axis]!;
        expect(s.text, `${axis} leaked for ${q}`).not.toMatch(words);
      }
    });
  }
});
