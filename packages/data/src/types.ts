/** Qualitative trait tendency values used in seed data */
export type QualitativeValue =
  | 'strong'
  | 'moderate'
  | 'slight'
  | 'neutral'
  | 'slight-risk'
  | 'moderate-risk';

/** Internal numeric mapping for qualitative values (0.0–1.0 scale) */
export const QUALITATIVE_MAP: Record<QualitativeValue, number> = {
  strong: 1.0,
  moderate: 0.7,
  slight: 0.4,
  neutral: 0.0,
  'slight-risk': -0.3,
  'moderate-risk': -0.6,
};

/** Component categories */
export type ComponentCategory =
  | 'speakers'
  | 'amplifier'
  | 'dac'
  | 'turntable'
  | 'cables'
  | 'streamer'
  | 'cartridge'
  | 'phono_stage';

/** Confidence levels */
export type ConfidenceLevel = 'high' | 'medium-high' | 'medium' | 'low';

// ── Primary Advisory Axes ────────────────────────────────
//
// The four perceptual axes and one outcome overlay that form the
// top-level reasoning model. Products and systems are positioned
// on these axes using qualitative labels — not numeric scores.

/** Position on a primary advisory axis. */
export type AxisLeaning = 'warm' | 'bright' | 'neutral';

/** Leaning on the Smooth ↔ Detailed axis. */
export type SmoothDetailedLeaning = 'smooth' | 'detailed' | 'neutral';

/** Leaning on the Elastic ↔ Controlled axis. */
export type ElasticControlledLeaning = 'elastic' | 'controlled' | 'neutral';

/** Leaning on the Scale ↔ Intimacy axis. */
export type AiryClosedLeaning = 'airy' | 'closed' | 'neutral';

/**
 * Primary axis leanings for a product or system.
 * These are the first thing the engine reads when reasoning about character.
 */
export interface PrimaryAxisLeanings {
  warm_bright: AxisLeaning;
  smooth_detailed: SmoothDetailedLeaning;
  elastic_controlled: ElasticControlledLeaning;
  airy_closed: AiryClosedLeaning;
}

/**
 * Fatigue assessment for a product or system.
 * This is a system-outcome overlay, not a design axis.
 */
export interface FatigueAssessment {
  /** Qualitative fatigue risk level. */
  risk: 'low' | 'moderate' | 'high' | 'context_dependent';
  /** When or why fatigue risk manifests. */
  notes: string;
}

// ── Secondary Trait Names ────────────────────────────────
//
// These are the finer-grained traits used for explanatory depth,
// product description, and diagnostic reasoning. They map to the
// primary axes (see Sonic Trait Framework v1 document).

/** Listening trait names — secondary descriptive traits */
export type TraitName =
  | 'flow'
  | 'tonal_density'
  | 'clarity'
  | 'dynamics'
  | 'soundstage'
  | 'fatigue_risk'
  | 'glare_risk'
  | 'damping_control'
  | 'texture'
  | 'bass_weight'
  | 'elasticity'
  | 'microdynamics'
  | 'low_volume_integrity'
  | 'composure'
  | 'sweetness'
  | 'openness'
  | 'rhythm'
  | 'groundedness'
  | 'spatial_precision';

/** Trusted reference entry */
export interface TrustedReference {
  source: string;
  note: string;
  type: 'direct_experience' | 'trusted_reviewer';
}

/** Review entry (contextual only) */
export interface Review {
  source: string;
  excerpt: string;
  role: 'contextual';
}

/** Retailer link */
export interface RetailerLink {
  label: string;
  url: string;
}

/** Seed component as stored in YAML */
export interface SeedComponent {
  id: string;
  name: string;
  brand: string;
  category: ComponentCategory;
  confidence_level: ConfidenceLevel;
  role_confidence?: Record<string, ConfidenceLevel>;
  trait_tendencies: Partial<Record<TraitName, QualitativeValue>>;
  risk_flags: string[];
  trusted_references: TrustedReference[];
  reviews: Review[];
  retailer_links?: RetailerLink[];
  is_reference: boolean;
  user_submitted: boolean;
}

/** Reference system as stored in YAML */
export interface ReferenceSystem {
  id: string;
  name: string;
  archetype: 'engagement' | 'composure' | 'both';
  component_ids: string[];
  description: string;
}

/** Archetype names */
export type ArchetypeName = 'engagement' | 'composure' | 'low_volume';

/** Sensitivity flags */
export type SensitivityFlag =
  | 'fatigue_sensitive'
  | 'glare_sensitive'
  | 'bass_sensitive'
  | 'volume_sensitive';
