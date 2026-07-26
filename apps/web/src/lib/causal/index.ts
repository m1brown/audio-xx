/**
 * Audio XX — Causal Explanation engine (Phase 1). Public surface.
 * Deterministic, no LLM. See docs/causal-explanation-architecture-v1.md.
 */
export type {
  CatalogFact,
  CausalComponent,
  CausalResult,
  CausalRole,
  InteractionInference,
  InteractionRule,
  RuleEligibility,
  Provenance,
  ProvenanceBasis,
  Confidence,
} from './types';

export {
  readCatalogFacts,
  categoryToRole,
  toCausalComponent,
  causalComponentById,
  resolveCausalComponentsFromNames,
  evaluateCausal,
} from './engine';

export {
  APPROVED_RULES,
  RULE_ELIGIBILITY,
  SET_HIGH_EFFICIENCY_RULE,
  isEligible,
} from './knowledge';
