/**
 * Audio XX — Causal Explanation engine, Phase 1 types.
 *
 * Design: docs/causal-explanation-architecture-v1.md (approved 2026-07-25/26).
 *
 * The governing invariant (§0): two verified facts about two components do NOT
 * verify a claim about their interaction. An interaction claim is admissible
 * only when an authored, provenance-backed InteractionRule exists for it. No
 * rule ⇒ no causal sentence.
 *
 * Three levels are kept type-distinct, plus a fourth deployment control:
 *   1. CatalogFact       — a verified fact about ONE component (read, never inferred).
 *   2. InteractionRule   — AUTHORED knowledge connecting two properties.
 *   3. InteractionInference — a rule applied to THIS system (substitution only).
 *   +  RuleEligibility   — a DEPLOYMENT CONTROL, not engineering knowledge.
 *
 * Phase 1 is fully deterministic. No LLM generates or infers any claim.
 */

export type Confidence = 'high' | 'medium' | 'low';

/** Ordered strongest → weakest; ordering is load-bearing for the confidence floor. */
export type ProvenanceBasis =
  | 'measured'
  | 'manufacturer_intent'
  | 'founder_reference'
  | 'review_consensus'
  | 'listener_consensus'
  | 'owner_reference'
  | 'editorial_inference'
  | 'authored_rule';

export interface Provenance {
  basis: ProvenanceBasis;
  sources?: ReadonlyArray<{ label: string; url?: string }>;
  note?: string;
}

export type CausalRole = 'source' | 'amp' | 'speaker' | 'other';

export type RuleStatus = 'draft' | 'reviewed' | 'approved' | 'rejected' | 'retired';

/**
 * A verified fact about ONE component, read directly from structured catalog
 * data. Never produced by prose parsing, inference, or model output.
 */
export interface CatalogFact {
  componentId: string;
  key: 'topology' | 'set_suitability_effect';
  value: string | number | boolean;
  provenance: Provenance;
}

/** A system component resolved to its catalog id, role, and structured facts. */
export interface CausalComponent {
  productId: string | null; // resolved catalog id; null when unresolved
  name: string;             // display name (brand + model)
  brand: string;
  role: CausalRole;
  facts: ReadonlyArray<CatalogFact>;
}

/**
 * DEPLOYMENT CONTROL — not engineering knowledge. An eligibility list asserts
 * only that these products have been reviewed and approved to *participate* in
 * a specific rule. It makes no claim that other products lack the property.
 * Exists because the raw catalog `topology` tag is not yet trustworthy for
 * this rule (see the pending `topology:'set'` audit).
 */
export interface RuleEligibility {
  ruleId: string;
  role: CausalRole;
  eligibleProductIds: ReadonlyArray<string>;
  note: string;
}

/** A predicate over one side of the interaction. Authored, total, pure. */
export interface PropertyPredicate {
  role: CausalRole;
  describe: string;
  matches: (component: CausalComponent) => boolean;
}

/**
 * AUTHORED knowledge connecting two property predicates. The only thing that
 * can license an interaction claim. Carries a REQUIRED contrast (the
 * inferability gate P4) and its own review lifecycle.
 */
export interface InteractionRule {
  id: string;
  status: RuleStatus;              // only 'approved' emits prose
  upstream: PropertyPredicate;
  downstream: PropertyPredicate;
  mechanism: string;
  consequence: string;
  contrast: { alternative: string; differingConsequence: string };
  exclusions: string;              // claims explicitly out of bounds
  provenance: Provenance;
  confidence: Confidence;
  authoredBy: string;
  reviewedBy?: string;
  approvalDate?: string;
}

/** A rule applied to THIS system. Substitution only — no new causal content. */
export interface InteractionInference {
  ruleId: string;
  upstream: { productId: string | null; role: CausalRole };
  downstream: { productId: string | null; role: CausalRole };
  boundFacts: ReadonlyArray<CatalogFact>;
  provenanceChain: ReadonlyArray<Provenance>;
  confidence: Confidence;
}

/** Deterministic evaluation output. `block` is null when no rule fires. */
export interface CausalResult {
  block: string | null;
  inference: InteractionInference | null;
}
