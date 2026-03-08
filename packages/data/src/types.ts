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

/** Listening trait names — the system's internal currency */
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
  | 'composure';

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
