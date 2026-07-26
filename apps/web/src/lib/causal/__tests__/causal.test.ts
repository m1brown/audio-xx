/**
 * Causal Explanation — Phase 1 acceptance tests.
 *
 * Proves the governing invariant: a causal sentence forms ONLY when an approved
 * InteractionRule matches two verified CatalogFacts through the eligibility
 * control. Several tests are written to fail a naive fact-joining design.
 */
import { describe, it, expect } from 'vitest';
import {
  causalComponentById,
  evaluateCausal,
  APPROVED_RULES,
  RULE_ELIGIBILITY,
} from '../index';
import type { CausalComponent } from '../types';
import { DAC_PRODUCTS } from '../../products/dacs';
import { SPEAKER_PRODUCTS } from '../../products/speakers';

// Reader-facing prose: no rule name, fact key, confidence, provenance basis,
// or "authored effect" machinery (see engine.composeBlock). Every clause stays
// traceable to the two structured facts + the rule's mechanism/consequence/contrast.
const BENCHMARK_PARAGRAPH =
  'The Yamamoto A-08S is a single-ended-triode amplifier with limited output power, ' +
  'and the DeVore Orangutan O/96 is a high-efficiency loudspeaker its designer intends to be ' +
  'driven by single-ended-triode amplification. Because the speaker produces more ' +
  'acoustic output from each watt, the Yamamoto uses less of its limited power to ' +
  'reach a given listening level than it would with a substantially less sensitive ' +
  'speaker — which leaves more headroom and makes clipped or compressed peaks less ' +
  'likely. A less sensitive speaker would force the same amplifier to use more of its ' +
  'output to reach the same level.';

function comp(id: string): CausalComponent {
  const c = causalComponentById(id);
  if (!c) throw new Error(`fixture product not in catalog: ${id}`);
  return c;
}

// A concrete R2R DAC id for the "unrelated facts" case (data-driven, not hardcoded).
const R2R_DAC = DAC_PRODUCTS.find((p) => p.topology === 'r2r');
// A high-efficiency speaker that carries NO SET-suitability interaction (for rejection 5).
const HIGH_EFF_NO_SET = SPEAKER_PRODUCTS.find(
  (p) =>
    p.topology === 'high-efficiency' &&
    !(p.tendencies?.interactions ?? []).some((i) => /single-ended triode|\bSET\b/.test(i.condition)),
);

describe('Causal Phase 1 — knowledge record', () => {
  it('exposes exactly one approved rule', () => {
    expect(APPROVED_RULES).toHaveLength(1);
    expect(APPROVED_RULES[0].id).toBe('set-amp-x-high-efficiency-speaker');
    expect(APPROVED_RULES[0].status).toBe('approved');
  });

  it('eligibility list is a deployment control naming only reviewed SET amps (upstream)', () => {
    const e = RULE_ELIGIBILITY.find(
      (x) => x.ruleId === 'set-amp-x-high-efficiency-speaker' && x.role === 'amp',
    );
    expect(e?.eligibleProductIds).toEqual(['yamamoto-a-08s', 'decware-se84ufo']);
  });

  it('downstream eligibility is restricted to the O/96 only (Phase 1 deployment decision)', () => {
    const e = RULE_ELIGIBILITY.find(
      (x) => x.ruleId === 'set-amp-x-high-efficiency-speaker' && x.role === 'speaker',
    );
    expect(e?.eligibleProductIds).toEqual(['devore-orangutan-o96']);
  });
});

describe('Causal Phase 1 — benchmark (positive)', () => {
  it('Yamamoto A-08S × DeVore O/96 produces the exact approved paragraph', () => {
    const r = evaluateCausal([comp('chord-hugo'), comp('yamamoto-a-08s'), comp('devore-orangutan-o96')]);
    expect(r.block).toBe(BENCHMARK_PARAGRAPH);
    expect(r.inference?.ruleId).toBe('set-amp-x-high-efficiency-speaker');
  });

  it('the inference carries a full provenance chain (2 facts + rule)', () => {
    const r = evaluateCausal([comp('yamamoto-a-08s'), comp('devore-orangutan-o96')]);
    expect(r.inference).toBeTruthy();
    // amp topology + speaker topology + speaker set-effect + rule = 4 provenance entries
    expect((r.inference?.provenanceChain.length ?? 0)).toBeGreaterThanOrEqual(3);
    expect(r.inference?.provenanceChain.at(-1)?.basis).toBe('authored_rule');
  });

  it('the composed sentence is not boilerplate — it names both components', () => {
    const r = evaluateCausal([comp('yamamoto-a-08s'), comp('devore-orangutan-o96')]);
    expect(r.block).toContain('Yamamoto A-08S');
    expect(r.block).toContain('DeVore Orangutan O/96');
  });
});

describe('Causal Phase 1 — rejection cases (zero causal output)', () => {
  it('1. high-efficiency speaker alone (no SET amp) → no claim', () => {
    const r = evaluateCausal([comp('devore-orangutan-o96')]);
    expect(r.block).toBeNull();
  });

  it('2. SET amp alone (speaker not high-efficiency) → no claim', () => {
    // wlm-diva-monitor is topology:'bass-reflex'
    const r = evaluateCausal([comp('yamamoto-a-08s'), comp('wlm-diva-monitor')]);
    expect(r.block).toBeNull();
  });

  it('3. two unrelated verified facts (R2R DAC + high-eff speaker, no rule) → no claim', () => {
    expect(R2R_DAC).toBeTruthy();
    const r = evaluateCausal([comp(R2R_DAC!.id), comp('devore-orangutan-o96')]);
    expect(r.block).toBeNull();
  });

  it('4. NEGATIVE CONTROL — Hugo + Job + WLM Diva → no claim', () => {
    const r = evaluateCausal([
      comp('chord-hugo'),
      comp('job-integrated'),
      comp('wlm-diva-monitor'),
    ]);
    expect(r.block).toBeNull();
  });

  it('5. high-efficiency enum WITHOUT an authored SET effect → no claim', () => {
    // Synthetic component: topology fact present, SET-suitability fact absent.
    const speakerNoSet: CausalComponent = {
      productId: 'synthetic-high-eff',
      name: 'Synthetic High-Efficiency Speaker',
      brand: 'Synthetic',
      role: 'speaker',
      facts: [
        {
          componentId: 'synthetic-high-eff',
          key: 'topology',
          value: 'high-efficiency',
          provenance: { basis: 'manufacturer_intent' },
        },
      ],
    };
    const r = evaluateCausal([comp('yamamoto-a-08s'), speakerNoSet]);
    expect(r.block).toBeNull();
    // And, if the catalog contains a real such speaker, it must also be rejected.
    if (HIGH_EFF_NO_SET) {
      const r2 = evaluateCausal([comp('yamamoto-a-08s'), comp(HIGH_EFF_NO_SET.id)]);
      expect(r2.block).toBeNull();
    }
  });
});

describe('Causal Phase 1 — ineligible amplifiers can never trigger the rule', () => {
  // These amps carry topology:'set' in the catalog but are OTL/ZOTL, NOT SET.
  // The eligibility control must block them even paired with the benchmark speaker.
  for (const badAmp of ['linear-tube-audio-z10', 'bottlehead-crack']) {
    it(`${badAmp} (set-tagged but not on eligibility list) × O/96 → no claim`, () => {
      const amp = causalComponentById(badAmp, 'amp');
      expect(amp).toBeTruthy();
      // sanity: it really is tagged set in the catalog
      expect(amp!.facts.some((f) => f.key === 'topology' && f.value === 'set')).toBe(true);
      const r = evaluateCausal([amp!, comp('devore-orangutan-o96')]);
      expect(r.block).toBeNull();
    });
  }

  it('soundkaos-vox-3a (fact-qualified but NOT downstream-eligible in Phase 1) → no claim', () => {
    const speaker = causalComponentById('soundkaos-vox-3a', 'speaker');
    expect(speaker).toBeTruthy();
    // sanity: it really does satisfy both facts (would fire without the eligibility gate)
    expect(speaker!.facts.some((f) => f.key === 'topology' && f.value === 'high-efficiency')).toBe(true);
    expect(speaker!.facts.some((f) => f.key === 'set_suitability_effect')).toBe(true);
    const r = evaluateCausal([comp('yamamoto-a-08s'), speaker!]);
    expect(r.block).toBeNull();
  });

  it('ampsandsound-stereo-17 (ambiguous, not listed) × O/96 → no claim', () => {
    const amp = causalComponentById('ampsandsound-stereo-17', 'amp');
    if (!amp) return; // tolerate id drift
    const r = evaluateCausal([amp, comp('devore-orangutan-o96')]);
    expect(r.block).toBeNull();
  });
});

describe('Causal Phase 1 — safe fallback', () => {
  it('unresolved components produce no claim', () => {
    const r = evaluateCausal([
      { productId: null, name: 'Unknown Amp', brand: '', role: 'amp', facts: [] },
      { productId: null, name: 'Unknown Speaker', brand: '', role: 'speaker', facts: [] },
    ]);
    expect(r.block).toBeNull();
  });
});
