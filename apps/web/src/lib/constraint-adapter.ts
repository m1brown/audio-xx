/**
 * Constraint Adapter — Engine ↔ Domain Boundary
 *
 * Translates domain-specific constraint categories into engine-level
 * constraint classes used by core reasoning modules (tradeoff-assessment,
 * preference-protection).
 *
 * This is the ONLY place domain constraint vocabulary touches engine logic.
 * Core modules reference EngineConstraintClass; they never see audio
 * (or any other domain's) category strings.
 *
 * Portability: to support a new domain, add a new mapping table here.
 * Engine modules remain unchanged.
 */

// ── Engine-level constraint classification ──────────

/**
 * Domain-agnostic constraint classes used by the core reasoning engine.
 *
 *   critical_mismatch  — two components are fundamentally incompatible
 *   systemic_imbalance — the system has accumulated directional bias
 *   capacity_limit     — a single component is at or beyond its effective range
 */
export type EngineConstraintClass =
  | 'critical_mismatch'
  | 'systemic_imbalance'
  | 'capacity_limit';

// ── Audio domain mapping ────────────────────────────

const AUDIO_CONSTRAINT_MAP: Record<string, EngineConstraintClass> = {
  power_match:       'critical_mismatch',
  stacked_bias:      'systemic_imbalance',
  tonal_imbalance:   'systemic_imbalance',
  dac_limitation:    'capacity_limit',
  speaker_scale:     'capacity_limit',
  amplifier_control: 'capacity_limit',
  source_limitation: 'capacity_limit',
};

// ── Resolver ────────────────────────────────────────

/**
 * Resolve a domain-specific constraint category to its engine-level class.
 * Returns undefined for unrecognized categories (safe fallback — engine
 * treats unknown constraints conservatively).
 */
export function resolveConstraintClass(
  category: string,
): EngineConstraintClass | undefined {
  return AUDIO_CONSTRAINT_MAP[category];
}
