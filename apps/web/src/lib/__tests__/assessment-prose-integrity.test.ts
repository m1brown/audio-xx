import { describe, it, expect } from 'vitest';
import { buildSystemAssessment } from '../consultation';
import { extractSubjectMatches } from '../intent';
import { toEvidenceItem } from '../evidence/manufacturer-facts';
import type { EvidenceItem } from '../evidence/evidence-types';

/**
 * Phase 2 — the assessment read as a product, not as a fixture.
 *
 * Three defects found by reading the complete listener-facing output of the
 * four control systems. All three are GENERATION failures: the reasoning was
 * right and the sentence that carried it was not. None is fixed by a
 * blacklist — each is a missing guard at the point of composition.
 */

const fact = (product: string, field: string, value: string, host: string): EvidenceItem =>
  toEvidenceItem(product, {
    field: field as never, value,
    sourceUrl: `https://${host}/products/x`, quotedText: value,
  }, Date.now());

const context = (text: string, ev: EvidenceItem[] = []): string => {
  const r = buildSystemAssessment(
    text, extractSubjectMatches(text), undefined, undefined, undefined, ev,
  ) as { response?: { systemContext?: string } };
  return r?.response?.systemContext ?? '';
};

const CONSTRAINED = 'Assess my system: Amp: Decware SE84UFO Speakers: Acora QRC-2 '
  + 'Dac: Denafrips Pontus II';
const COHERENT = 'Assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus';

describe('a withheld name does not leave a dangling article', () => {
  // The D-12 filter drops an unlicensed component from the name list, and the
  // clause was composed from that list unconditionally — so the only
  // loudspeaker being uncatalogued published "lean toward warmth and ease,
  // reinforced by the ." Withhold the clause, not just the name inside it.
  const out = context(CONSTRAINED, [fact('Acora QRC-2', 'sensitivity', '84 dB', 'acoraaudio.com')]);

  it('emits no empty article', () => {
    expect(out).not.toMatch(/\bby the \./);
    expect(out).not.toMatch(/\bthe \.\s/);
    expect(out).not.toMatch(/\bwith the\s+(?:supplying|adding)/);
  });

  it('still states the upstream character it can license', () => {
    expect(out).toMatch(/lean toward warmth and ease\./);
  });

  it('still names the component it could not read, without characterising it', () => {
    expect(out).toMatch(/Acora QRC-2/);
    expect(out).not.toMatch(/Acora QRC-2 → .*(?:warm|bright|smooth|resolving)/);
  });
});

describe('interpolated catalog text does not run into the next sentence', () => {
  it('terminates the interaction fragment', () => {
    const out = context(CONSTRAINED, [fact('Acora QRC-2', 'sensitivity', '84 dB', 'acoraaudio.com')]);
    expect(out).not.toMatch(/comfort zone This system/);
    // A lowercase word running straight into a new capitalised sentence is the
    // signature of the defect, wherever it appears.
    expect(out).not.toMatch(/[a-z] This system reflects/);
  });
});

describe('a component is named the way its owner would name it', () => {
  const out = context(COHERENT);

  it('never reduces a model to a bare number or qualifier', () => {
    // "Naim SuperNait 3" → "3" and "Harbeth Super HL5 Plus" → "Plus" produced
    // "the Qutest/3/Plus chain", "the 3's amplification", "the Plus's final
    // voicing" — sentences about components nobody owns.
    expect(out).not.toMatch(/\bthe 3'?s\b/);
    expect(out).not.toMatch(/\bthe Plus'?s\b/);
    expect(out).not.toMatch(/\/3\//);
    expect(out).not.toMatch(/\/Plus\b/);
  });

  it('uses the recognisable short model name', () => {
    expect(out).toMatch(/SuperNait 3/);
    expect(out).toMatch(/HL5 Plus/);
  });
});

describe('the coherent control keeps its earned restraint', () => {
  const out = context(COHERENT);
  it('reports no constraint and no headroom problem', () => {
    expect(out).not.toMatch(/underpowered|limited headroom/i);
    expect(out).toMatch(/nothing needs correcting/i);
  });
});
