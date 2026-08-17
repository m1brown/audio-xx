import { describe, it, expect } from 'vitest';
import { buildSystemAssessment, carriesAxisEvidence } from '../consultation';
import { extractSubjectMatches } from '../intent';

/**
 * Repair 2 — an unresolved identity must not become neutral evidence.
 *
 * `classifyComponentAxes` hands a component it cannot resolve four `neutral`
 * axes so downstream code has something to read. But `neutral` is a sonic
 * claim — "this sits at the middle of the axis" — and once it leaves that
 * function nothing distinguishes it from a measured neutral. Production
 * consequence, found by running the A-H matrix against the promoted build:
 * a product I invented for the test,
 *
 *   Zorblax ZX1 5 watt SET
 *
 * was rendered as "neutral, controlled -> preserves speed and edge" and then
 * folded into "Denafrips Pontus II and Zorblax ZX1 5 watt SET and Klipsch
 * Cornwall IV reinforce the same direction."
 *
 * `source: 'inferred'` already marked that state and was never consulted.
 * These tests hold the marker to its meaning.
 */

const FICTIONAL = 'Zorblax ZX1 5 watt SET';

function assess(text: string) {
  return buildSystemAssessment(text, extractSubjectMatches(text), undefined, undefined, undefined);
}

/** Every string the listener actually reads, flattened. */
function prose(result: unknown): string {
  const r = result as { response?: Record<string, unknown> };
  if (!r?.response) return '';
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(r.response);
  return out.join('\n');
}

describe('the licensing marker means what it says', () => {
  it('inferred profiles carry no evidence; product and brand profiles do', () => {
    expect(carriesAxisEvidence({ source: 'inferred' })).toBe(false);
    expect(carriesAxisEvidence({ source: 'product' })).toBe(true);
    expect(carriesAxisEvidence({ source: 'brand' })).toBe(true);
  });
});

describe('CONTROL — fictional component in an otherwise real chain', () => {
  const text = `Assess my system: Dac: Denafrips Pontus II Pre-amp: ARC ref 5 `
    + `Amp: ${FICTIONAL} Speakers: Klipsch Cornwall IV`;
  const result = assess(text);
  const text_out = prose(result);

  it('keeps the identity in the graph', () => {
    // Identity and role are real — the listener owns the thing and told us
    // where it sits. Only the sonic character was never established.
    expect(text_out).toContain('Zorblax');
  });

  it('does not give it a sonic behaviour string', () => {
    expect(text_out).not.toMatch(new RegExp(`${FICTIONAL}\\\\s*→\\\\s*(?:neutral|warm|bright|smooth|detailed|elastic|controlled|tone-rich|fast|lean|resolving)`, 'i'));
  });

  it('does not enlist it in reinforcement reasoning', () => {
    // The exact production sentence: a fabricated product voting on the
    // direction the system leans.
    const reinforce = text_out.match(/[^.\n]*reinforce the same direction[^.\n]*/gi) ?? [];
    for (const sentence of reinforce) expect(sentence).not.toMatch(/Zorblax/i);
  });

  it('does not claim it preserves or shapes what the others do', () => {
    const claims = /Zorblax[^.\n]*(?:preserves speed and edge|low coloration|passes the|anchors the tonal|defines the tonal|carries the)/i;
    expect(text_out).not.toMatch(claims);
  });

  it('does not assert an unqualified no-change verdict over the whole system', () => {
    // "No single component is holding this system back" quantifies over every
    // component, including the one never assessed.
    if (/no obvious bottleneck|nothing needs correcting/i.test(text_out)) {
      expect(text_out).toMatch(/could not identify|cannot say|Nothing in what I could assess|No component I could assess/i);
    }
  });
});

describe('CONTROL — a fully catalogued chain is unchanged', () => {
  const text = 'Assess my system: Amp: Leben CS600 Speakers: Harbeth Compact 7ES-3 Dac: Audio Note DAC 2.1x';
  const text_out = prose(assess(text));

  it('still reaches a system reading', () => {
    expect(text_out.length).toBeGreaterThan(200);
  });

  it('still states reinforcement where the evidence supports it', () => {
    // The guard must not make Audio XX mute on systems it genuinely knows.
    expect(text_out).toMatch(/reinforce|lean|warm|rich/i);
  });

  it('carries no unassessed-component qualifier', () => {
    expect(text_out).not.toMatch(/could not identify/i);
  });
});

describe('CONTROL — mixed chain: strong claims only from licensed components', () => {
  const text = `Assess my system: Amp: ${FICTIONAL} Speakers: Magnepan LRS+ Dac: Denafrips Pontus II`;
  const text_out = prose(assess(text));

  it('still assesses the components it holds evidence for', () => {
    expect(text_out).toMatch(/Magnepan|Denafrips/);
  });

  it('names the unassessed component as unassessed', () => {
    expect(text_out).toMatch(/could not identify|not identified|no sonic characteristics/i);
  });

  it('never describes the fictional amplifier tonally', () => {
    const sentences = text_out.split(/(?<=[.!?\n])/).filter((s) => /Zorblax/i.test(s));
    for (const s of sentences) {
      expect(s).not.toMatch(/\b(?:warm|bright|smooth|detailed|elastic|controlled|neutral, controlled|tone-rich)\b/i);
    }
  });
});
