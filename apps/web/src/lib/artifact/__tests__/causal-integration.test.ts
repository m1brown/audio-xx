/**
 * Licensed causal integration + retirement of the default brand-house block.
 *
 * Governing expression rule (founder, 2026-07-27):
 *   - brand-house knowledge must NOT surface as one standalone note per
 *     qualifying component;
 *   - a system-level contribution may only come from an approved interaction
 *     license (no fact-joining, no synergy-from-coexistence);
 *   - when a license fires, it is woven into the mechanism arc, not appended.
 *
 * These tests exercise the real artifact pipeline (v2 renderer path).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { runArtifactPipeline } from '../../../product/assessment-pipeline';

const CAUSAL = 'NEXT_PUBLIC_CAUSAL_EXPLANATION';
const BRAND = 'NEXT_PUBLIC_BRAND_HOUSE_VOICING';

// No approved InteractionRule connects the Leben's push-pull topology to the
// O/96: this is the negative control.
const NEGATIVE = 'Assess my system: Denafrips Ares II, Leben CS600, DeVore Orangutan O/96';
// Covered by the approved SET × high-efficiency rule (Yamamoto on the amp
// eligibility list, O/96 on the speaker list): the positive control.
const POSITIVE = 'Assess my system: Chord Hugo, Yamamoto A-08S, DeVore Orangutan O/96';

const CAUSAL_SENTENCE =
  'The Yamamoto A-08S is a single-ended-triode amplifier with limited output power, ' +
  'and the DeVore Orangutan O/96 is a high-efficiency loudspeaker its designer intends to be ' +
  'driven by single-ended-triode amplification. Because the speaker produces more ' +
  'acoustic output from each watt, the Yamamoto uses less of its limited power to ' +
  'reach a given listening level than it would with a substantially less sensitive ' +
  'speaker — which leaves more headroom and makes clipped or compressed peaks less ' +
  'likely. A less sensitive speaker would force the same amplifier to use more of its ' +
  'output to reach the same level.';

function setFlags({ causal, brand }: { causal: boolean; brand: boolean }) {
  process.env[CAUSAL] = causal ? 'on' : 'off';
  process.env[BRAND] = brand ? 'on' : 'off';
}
function allText(sys: string): string {
  const p = runArtifactPipeline(sys)!.payload;
  return [p.recognition, ...p.caseParagraphs, p.recommendation].join('\n');
}

afterEach(() => {
  delete process.env[CAUSAL];
  delete process.env[BRAND];
});

describe('Negative control — Leben × O/96 (no license, both flags on)', () => {
  it('renders no "On the houses" block and no per-component brand profile', () => {
    setFlags({ causal: true, brand: true });
    const p = runArtifactPipeline(NEGATIVE)!.payload;
    // The retired C1 field no longer exists on the payload.
    expect('brandNotes' in (p as object)).toBe(false);
    expect(allText(NEGATIVE)).not.toMatch(/on the houses/i);
  });

  it('renders no causal / joined compatibility or synergy claim', () => {
    setFlags({ causal: true, brand: true });
    const text = allText(NEGATIVE);
    // The SET rule must not fire for the push-pull Leben.
    expect(text).not.toContain(CAUSAL_SENTENCE);
    expect(text).not.toMatch(/single-ended-triode/i);
    // No manufactured "these two were made for each other" synergy prose.
    expect(text).not.toMatch(/canonical partner|made for each other|perfect match|designed to be driven by/i);
  });

  it('two qualifying brand-house entries but no InteractionRule ⇒ no joined prose; flag-on == flag-off', () => {
    setFlags({ causal: true, brand: true });
    const on = runArtifactPipeline(NEGATIVE)!.payload;
    setFlags({ causal: false, brand: false });
    const off = runArtifactPipeline(NEGATIVE)!.payload;
    expect(JSON.stringify(on)).toBe(JSON.stringify(off));
  });
});

describe('Positive control — Yamamoto × O/96 (licensed, integrated)', () => {
  it('gains exactly one integrated causal contribution, woven into the mechanism arc', () => {
    setFlags({ causal: true, brand: true });
    const paras = runArtifactPipeline(POSITIVE)!.payload.caseParagraphs;
    expect(paras.filter((p) => p === CAUSAL_SENTENCE)).toHaveLength(1);
    const idx = paras.indexOf(CAUSAL_SENTENCE);
    expect(idx).toBeGreaterThan(0);
    expect(/hangs together|coherence|nothing upstream fights/i.test(paras[idx - 1])).toBe(true);
  });

  it('no "On the houses" heading anywhere', () => {
    setFlags({ causal: true, brand: true });
    expect(allText(POSITIVE)).not.toMatch(/on the houses/i);
  });

  it('makes no overclaim beyond the license (no universal / synergy / room / max-volume)', () => {
    setFlags({ causal: true, brand: true });
    const text = allText(POSITIVE);
    expect(text).not.toMatch(/universal|any (tube|amplifier|speaker)|always|guarantee|perfect (match|synergy)/i);
    expect(text).not.toMatch(/\broom\b.*\bsuit/i);
    expect(text).not.toMatch(/loudest|maximum volume|as loud as/i);
  });

  it('the causal paragraph does not duplicate the coherence or recommendation paragraphs', () => {
    setFlags({ causal: true, brand: true });
    const p = runArtifactPipeline(POSITIVE)!.payload;
    const others = p.caseParagraphs.filter((x) => x !== CAUSAL_SENTENCE);
    expect(others).not.toContain(CAUSAL_SENTENCE);
    expect(p.recommendation).not.toContain(CAUSAL_SENTENCE);
    // The causal (power/headroom) claim is a different axis from trait coherence.
    expect(CAUSAL_SENTENCE).not.toMatch(/shared voicing|amplified by design/i);
  });
});

describe('Safe-off — positive system flag-off is byte-identical minus the causal paragraph', () => {
  it('flag-off payload equals flag-on with the causal paragraph removed', () => {
    setFlags({ causal: true, brand: true });
    const on = runArtifactPipeline(POSITIVE)!.payload;
    setFlags({ causal: false, brand: false });
    const off = runArtifactPipeline(POSITIVE)!.payload;
    const stripped = {
      ...on,
      caseParagraphs: on.caseParagraphs.filter((x) => x !== CAUSAL_SENTENCE),
    };
    expect(JSON.stringify(stripped)).toBe(JSON.stringify(off));
  });
});
