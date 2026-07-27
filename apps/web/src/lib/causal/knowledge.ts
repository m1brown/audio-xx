/**
 * Audio XX — Causal Explanation, Phase 1 AUTHORED KNOWLEDGE record.
 *
 * This file is the reviewed knowledge base for Phase 1: the rule eligibility
 * list (a deployment control) and the single approved InteractionRule. It is
 * data, not composer logic. Adding or changing an entry here is a reviewed
 * knowledge-base change, held to the same bar as a catalog edit.
 *
 * Approved by founder (Mike Brown) 2026-07-26 with final narrowing:
 *   - eligibility list, NOT the raw topology:'set' tag (catalog audit pending);
 *   - downstream = high-efficiency enum AND an authored SET-suitability effect;
 *   - the SET capsule's ≥93 dB figure is contextual support, NOT a predicate;
 *   - mechanism/contrast bounded to power↔sensitivity only (no voltage/current,
 *     no bass/impedance/damping/SPL/room/operating-region claims).
 */
import type {
  CatalogFact,
  CausalComponent,
  InteractionRule,
  RuleEligibility,
} from './types';

// ── Fact helpers (pure; read a resolved component's structured facts) ────────
export function hasFactValue(
  facts: ReadonlyArray<CatalogFact>,
  key: CatalogFact['key'],
  value: string,
): boolean {
  return facts.some((f) => f.key === key && String(f.value).toLowerCase() === value.toLowerCase());
}

export function hasFactKey(facts: ReadonlyArray<CatalogFact>, key: CatalogFact['key']): boolean {
  return facts.some((f) => f.key === key);
}

// ── Rule eligibility (DEPLOYMENT CONTROL — not engineering knowledge) ─────────
export const RULE_ELIGIBILITY: ReadonlyArray<RuleEligibility> = [
  {
    ruleId: 'set-amp-x-high-efficiency-speaker',
    role: 'amp',
    eligibleProductIds: ['yamamoto-a-08s', 'decware-se84ufo'],
    note:
      'Phase 1 Eligibility List (upstream). Reviewed and approved to participate in this ' +
      'rule. Asserts nothing about other amplifiers. The raw catalog topology:"set" tag is ' +
      'NOT trusted here — several set-tagged amps are actually OTL/ZOTL (audit pending). ' +
      'Approved by founder 2026-07-26.',
  },
  {
    ruleId: 'set-amp-x-high-efficiency-speaker',
    role: 'speaker',
    eligibleProductIds: ['devore-orangutan-o96'],
    note:
      'Phase 1 Eligibility List (downstream). DELIBERATE Phase 1 deployment decision ' +
      '(founder, 2026-07-26): keep the reference implementation minimal — one canonical ' +
      'interaction, not maximum product coverage. SoundKaos Vox 3a also qualifies on facts ' +
      '(high-efficiency + review_consensus SET effect) but is INTENTIONALLY excluded from ' +
      'Phase 1. This is not a judgment about the Vox 3a. Future speakers are added through ' +
      'the normal knowledge-authoring and review process.',
  },
];

export function isEligible(productId: string | null, ruleId: string, role: string): boolean {
  if (!productId) return false;
  return RULE_ELIGIBILITY.some(
    (e) => e.ruleId === ruleId && e.role === role && e.eligibleProductIds.includes(productId),
  );
}

// ── The single approved InteractionRule ──────────────────────────────────────
const RULE_ID = 'set-amp-x-high-efficiency-speaker';

export const SET_HIGH_EFFICIENCY_RULE: InteractionRule = {
  id: RULE_ID,
  status: 'approved',
  upstream: {
    role: 'amp',
    describe: 'SET amplifier on the Phase 1 eligibility list, carrying topology:set',
    matches: (c: CausalComponent) =>
      isEligible(c.productId, RULE_ID, 'amp') && hasFactValue(c.facts, 'topology', 'set'),
  },
  downstream: {
    role: 'speaker',
    describe:
      'high-efficiency loudspeaker the manufacturer designed especially for low-powered tube ' +
      'amplifiers (carries the authored set_suitability_effect fact; SET-specific suitability is ' +
      'treated as review/inference, not manufacturer intent), on the Phase 1 downstream ' +
      'eligibility list',
    matches: (c: CausalComponent) =>
      isEligible(c.productId, RULE_ID, 'speaker') &&
      hasFactValue(c.facts, 'topology', 'high-efficiency') &&
      hasFactKey(c.facts, 'set_suitability_effect'),
  },
  mechanism:
    'A single-ended-triode amplifier has limited output power. A high-efficiency loudspeaker ' +
    'produces greater acoustic output from each available watt, so it requires less amplifier ' +
    'power for a given acoustic level than a substantially less sensitive loudspeaker.',
  consequence:
    "The pairing therefore uses less of the amplifier's available output for the same level, " +
    'preserving more headroom and reducing the likelihood of clipped or compressed peaks.',
  contrast: {
    alternative: 'a substantially less sensitive loudspeaker',
    differingConsequence:
      'the same amplifier would have to use more of its available output to reach the same ' +
      'acoustic level, leaving less headroom and increasing the likelihood of clipping or ' +
      'compressed peaks',
  },
  exclusions:
    'No claim about absolute achievable volume, room suitability, bass control, impedance ' +
    'stability, damping behaviour, frequency-response effects, or a measured low-distortion ' +
    'operating region.',
  provenance: {
    basis: 'authored_rule',
    sources: [
      { label: 'topology-philosophy capsule — power↔sensitivity mechanism (engineering inference)' },
      {
        label:
          'DeVore Fidelity — O/96 manufacturer page: "designed especially for low-powered tube ' +
          'amplifiers"; 96 dB/W/M, 10 ohms (manufacturer_intent + specification)',
        url: 'https://devorefidelity.com/devore-fidelity-speakers/orangutan-series/devore-fidelity-o-96-speakers/',
      },
      {
        label:
          'John DeVore interview (Positive Feedback) — tube/impedance rationale; "very unfussy" ' +
          'across amp types (designer quotation)',
        url: 'https://www.positive-feedback.com/Issue75/devore_orangutan.htm',
      },
      {
        label:
          'SET-specific suitability: review consensus + engineering inference, NOT manufacturer ' +
          'intent (medium confidence)',
      },
    ],
    note:
      'Knowledge audit 2026-07-27: the manufacturer-stated intent is "low-powered tube ' +
      'amplifiers," not SET specifically; John DeVore never says "SET" on record and calls the ' +
      'O/96 "very unfussy" across amp types. SET-suitability is therefore retained as ' +
      'review-consensus / engineering-inference, not manufacturer intent. Stereophile\'s Atkinson ' +
      'measurement text was inaccessible (HTTP 403); the load characterisation rests on the ' +
      'manufacturer page + specification figures. The topology capsule\'s ≥93 dB threshold is ' +
      'contextual support only, NOT an active predicate in Phase 1. (Deferred to a later ' +
      'refactor: renaming the set_suitability_effect fact key and relabelling the shared O/96 ' +
      'catalog interaction basis.)',
  },
  confidence: 'high',
  authoredBy: 'project draft (Claude)',
  reviewedBy: 'founder (Mike Brown)',
  approvalDate: '2026-07-27',
};

/** Only approved rules may generate public prose. */
export const APPROVED_RULES: ReadonlyArray<InteractionRule> = [SET_HIGH_EFFICIENCY_RULE].filter(
  (r) => r.status === 'approved',
);
