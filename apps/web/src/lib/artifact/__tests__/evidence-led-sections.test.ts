import { describe, it, expect } from 'vitest';
import { evidenceStatement, toCanonicalAssessment } from '../canonical';
import { characterRead, synthesizeArtifact } from '../synthesizeArtifact';
import type { ArtifactPayload } from '../types';

/**
 * The three v2 sections that failed the evidence-led rule: every substantive
 * section must earn its presence from a licensed finding or a useful evidence
 * state, and length is an output rather than a requirement.
 */

const payload = (over: Partial<ArtifactPayload> = {}): ArtifactPayload => ({
  verdict: 'Nothing here needs changing.',
  componentCredit: ['Leben CS600', 'Klipsch Cornwall IV'],
  recognition: 'This system reads rhythmically elastic.',
  caseParagraphs: ['Leben CS600 resolves cleanly.'],
  recommendation: 'There is nothing here to fix.',
  date: '20 AUGUST 2026',
  ...over,
});

const raw = (findings: Record<string, unknown>) => ({ findings, response: {} });

describe('LISTENING SESSION is never authored from catalog axes', () => {
  /**
   * THE SECTION IS GONE, NOT GATED.
   *
   * This suite once asked whether the passage EARNED its presence, and the
   * two gates it enforced were real improvements: no canned prediction beside
   * a diagnosed bottleneck, and no prediction at all with every axis neutral.
   * Both stopped the section CONTRADICTING the verdict.
   *
   * Neither made it licensed. A passage that agrees with the verdict is still
   * unlicensed if nothing establishes what a listener will hear, and the
   * passage was three hard-coded openings selected by reading `systemAxes`.
   *
   * Production settled it (founder, 2026-08-24): Leben CS600X with Klipsch
   * Cornwall IV published both paragraphs — a coherent, committed system that
   * passed both gates — while Audio XX held ZERO manufacturer facts for the
   * Leben and no listening evidence for either component.
   *
   * A sensory claim needs listening evidence. Where Audio XX holds some, it
   * appears in the dossier with the comparison it was made under.
   */
  const CASES: Array<[string, Record<string, unknown>]> = [
    ['a diagnosed bottleneck', { bottleneck: { category: 'power_match' }, systemAxes: { smooth_detailed: 'detailed' } }],
    ['no committed axis', { systemAxes: { warm_bright: 'neutral', smooth_detailed: 'balanced' } }],
    ['a coherent, committed system', { systemAxes: { elastic_controlled: 'elastic', smooth_detailed: 'detailed' } }],
    ['a warm-committed system', { systemAxes: { warm_bright: 'warm' } }],
  ];

  for (const [label, findings] of CASES) {
    it(`is absent for ${label}`, () => {
      const cam = toCanonicalAssessment(payload(), raw(findings));
      expect(cam.reading.listeningSession).toEqual([]);
    });
  }

  it('none of the canned openings survives anywhere in the model', async () => {
    const { readFileSync } = await import('node:fs');
    // Comments are stripped first: the removal note QUOTES the deleted prose,
    // which is the point of the note. What must not survive is code that can
    // emit it.
    const src = readFileSync('apps/web/src/lib/artifact/canonical.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const canned of [
      /Put on something with air and inner detail/,
      /leading edges are clean and quick/,
      /image extends wide without being pushed forward/,
      /Put on something with body and tone/,
      /Over a long evening the character holds/,
    ]) expect(src, String(canned)).not.toMatch(canned);
  });

  it('is not replaced by anything', () => {
    // Absence is the finished state. A section removed for lacking evidence
    // must not return as a shorter section with the same lack.
    const cam = toCanonicalAssessment(payload(), raw({ systemAxes: { smooth_detailed: 'detailed' } }));
    expect(cam.reading.listeningSession).toEqual([]);
    expect(cam.reading.dominantCharacter).toBeUndefined();
  });
});

describe('RECOGNITION reports character, never intent', () => {
  it('uses no verb of choosing, asking or building', () => {
    // Numeric aggregates now — see `axis-poles.ts`. The categorical field is
    // no longer an independent truth for a system-level pole.
    for (const axes of [
      { warm_bright: -1 }, { smooth_detailed: 1 },
      { elastic_controlled: -1, warm_bright: 1 },
    ]) {
      const r = characterRead(axes)!;
      expect(r, JSON.stringify(axes)).toBeTruthy();
      expect(r).not.toMatch(/built for|chosen|asked|assembled|traded|left to|allowed|intended|deliberate/i);
    }
  });

  it('reads the committed axis behaviourally, strongest first', () => {
    expect(characterRead({ smooth_detailed: 1 })).toBe('high in resolution');
    // Ranked by magnitude: the strongest commitment leads.
    expect(characterRead({ warm_bright: -1, elastic_controlled: 0.6 }))
      .toBe('tonally warm, with firm dynamic grip');
  });

  it('IS SILENT on an axis inside the balanced band', () => {
    // THE FRANCE DEFECT. smooth_detailed aggregates to +0.1 — dead centre —
    // and was rendered "with detail held back from the front" beside a graph
    // reading Balanced and an Engineering line saying two of three components
    // lean DETAILED. Three values, one axis, one page.
    const r = characterRead({ warm_bright: -0.6, smooth_detailed: 0.1, elastic_controlled: -0.8 });
    expect(r).toBe('rhythmically elastic, with tonal weight');
    expect(r).not.toMatch(/detail|resolution|smooth/i);
  });

  it('is ABSENT when nothing is committed — no neutral fallback', () => {
    // The old function returned "built for balance — no single quality asked to
    // dominate", which is an intent claim manufactured from an absence.
    expect(characterRead({ warm_bright: 0.1, smooth_detailed: -0.2 })).toBeUndefined();
    expect(characterRead(undefined)).toBeUndefined();
    expect(characterRead({})).toBeUndefined();
  });
});

describe('EVIDENCE statement reflects the classes actually used', () => {
  it('claims only Audio XX analysis when no primary source is attached', () => {
    expect(evidenceStatement([])).toBe('Assessment based on Audio XX analysis.');
  });

  it('never asserts designer statements without one', () => {
    const s = evidenceStatement([
      { label: 'Spec sheet', url: 'https://example.test', evidenceClass: 'manufacturer' }]);
    expect(s).toBe('Assessment based on manufacturer documentation and Audio XX analysis.');
    expect(s).not.toMatch(/designer/);
  });

  it('asserts both when both are present', () => {
    expect(evidenceStatement([
      { label: 'Spec', url: 'https://a.test', evidenceClass: 'manufacturer' },
      { label: 'Interview', url: 'https://b.test', evidenceClass: 'designer' },
    ])).toBe('Assessment based on manufacturer documentation, designer statements, and Audio XX analysis.');
  });

  it('counts manual and technical sources as manufacturer documentation', () => {
    expect(evidenceStatement([
      { label: 'Manual', url: 'https://a.test', evidenceClass: 'manual' }]))
      .toMatch(/manufacturer documentation/);
  });
});

describe('no section infers why the owner chose anything', () => {
  const INTENT =
    /assembled for|chosen for|has been chosen|was chosen|built for|asked to|selected to|by design|on purpose|deliberate/i;

  it('holds for every prose string in the synthesizer', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      new URL('../synthesizeArtifact.ts', import.meta.url), 'utf8');
    // Prose literals only. Comments legitimately quote the old defect, and a
    // crude match over raw source grabs code fragments as well as sentences.
    const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
    const offenders: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const lit = m[1] ?? m[2] ?? m[3];
      if (lit && /\s/.test(lit) && lit.split(/\s+/).length >= 5 && INTENT.test(lit)) {
        offenders.push(lit.slice(0, 70));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('RECOGNITION under a diagnosed physical constraint', () => {
  // Recognition is produced by the SYNTHESIZER, not the CAM adapter — the
  // adapter passes `payload.recognition` straight through, so a fixture that
  // hard-codes it tests nothing.
  const synth = (findings: Record<string, unknown>) => synthesizeArtifact({
    findings: { systemChain: { names: ['Amp', 'Speakers'] }, ...findings },
    response: { assessmentStrengths: [], assessmentLimitations: [], upgradePaths: [] },
  }).payload;

  it('withholds the axes the constraint governs', () => {
    // Live defect: "The amplifier can't drive these speakers." followed by
    // "This system reads high in resolution, with firm dynamic grip." Firm
    // grip is exactly what a clipping amplifier does not deliver.
    const p = synth({ bottleneck: { category: 'power_match', role: 'speakers' },
      systemAxes: { smooth_detailed: 'detailed', elastic_controlled: 'controlled' } });
    expect(p.recognition).toBe('');
  });

  it('still reports an axis the constraint does NOT govern', () => {
    // A power mismatch says nothing about tonal balance. A warm system is
    // still warm, and blanket suppression would be the over-correction.
    const p = synth({ bottleneck: { category: 'power_match', role: 'speakers' },
      systemAxisNumeric: { warm_bright: -1, elastic_controlled: 1 } });
    expect(p.recognition).toBe('This system reads tonally warm.');
  });

  it('leaves a coherent system untouched', () => {
    const p = synth({ systemAxisNumeric: { smooth_detailed: 1, elastic_controlled: -0.5 } });
    expect(p.recognition).toMatch(/^This system reads high in resolution/);
  });
});
