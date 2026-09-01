/**
 * Cross-brand attribution in substitution-phrased assessment questions.
 *
 * Production repro (Wave-2 battery, 2026-08-29, idle mode):
 * "What about a Leben CS600 instead of the PrimaLuna?" produced
 * "The Leben Cs600 isn't in my catalog, but Primaluna designs Push-pull
 * tube, EL34/KT88/KT120/KT150 ... the Leben Cs600 sits in that family."
 * — PrimaLuna's EVO 300 topology and house sound grafted onto Leben.
 *
 * D-7 (epistemic fidelity) violation: false attribution. The sentence
 * carries two brands — the product subject ("leben cs600") is the
 * assessment SUBJECT; the brand subject ("primaluna") names the component
 * being replaced. buildProductAssessment bound brandName to the first
 * brand-kind subject match anywhere in the sentence, with no check that
 * the brand belongs to the product being assessed.
 *
 * Invariant: the brand identity rendered in a product assessment must be
 * derivable from the SUBJECT's own tokens. A brand that appears elsewhere
 * in the sentence must never supply topology, house-sound prose, traits,
 * or the candidateBrand label.
 *
 * (Mid-assessment substitution turns no longer reach this lane — caf07ec's
 * SUBSTITUTION_REFERENT guard — so these run the lane directly, as the
 * idle-mode path does.)
 */

import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';
import { buildProductAssessment } from '../product-assessment';
import type { AssessmentContext } from '../product-assessment';

function assess(msg: string) {
  const r = detectIntent(msg);
  return buildProductAssessment({
    subjectMatches: r.subjectMatches,
    activeSystem: null,
    tasteProfile: null,
    advisoryCtx: null,
    currentMessage: msg,
  } as unknown as AssessmentContext);
}

describe('substitution questions naming two brands', () => {
  it('unknown Leben model vs PrimaLuna: no PrimaLuna character anywhere in the assessment', () => {
    const a = assess('What about a Leben CS600 instead of the PrimaLuna?');
    expect(a, 'the lane must still produce an assessment').not.toBeNull();
    expect(a!.candidateBrand).toBe('Leben');
    // The whole rendered payload — shortAnswer, whatChanges, traits,
    // description, recommendation — must carry nothing from the brand
    // being replaced.
    const payload = JSON.stringify(a);
    expect(payload).not.toMatch(/primaluna/i);
    // And no grafted PrimaLuna EVO topology string.
    expect(payload).not.toMatch(/KT120|KT150|AutoBias/i);
    // It should still say something true about Leben (pilot capsule),
    // hedged as outside the catalog.
    expect(a!.shortAnswer).toMatch(/Leben/);
    expect(payload).toMatch(/catalog/i);
  });

  it('reverse direction — catalog PrimaLuna vs Leben: no Leben character grafted', () => {
    const a = assess('What about a PrimaLuna EVO 300 instead of the Leben?');
    expect(a).not.toBeNull();
    expect(a!.candidateBrand).toBe('PrimaLuna');
    expect(JSON.stringify(a)).not.toMatch(/leben/i);
  });

  it('control (D-011): same-brand unknown model still hedges with that brand\'s character', () => {
    // Brand-only match with no product subject — the guard must not
    // suppress the legitimate single-brand fallback.
    const a = assess('what do you think of the primaluna evo 999');
    expect(a).not.toBeNull();
    expect(a!.candidateBrand).toMatch(/primaluna/i);
    expect(a!.shortAnswer).toMatch(/don'?t have/i);
    expect(a!.shortAnswer).toMatch(/primaluna/i);
  });
});
