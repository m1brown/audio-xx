/**
 * Provisional Product Layer — Types.
 *
 * Provisional products are structured product records derived from
 * review synthesis or LLM inference. They use the same trait model
 * as the validated catalog but carry explicit provenance metadata
 * so the advisory engine can distinguish trust levels.
 *
 * ── Provenance tiers ─────────────────────────────────────────────
 *
 *   reference          Highest-confidence entries intentionally
 *                      calibrated within the Audio XX catalog.
 *                      Anchor products for the trait model.
 *                      (Lives in validated catalog, not here.)
 *
 *   review_synthesis   Derived from aggregated review consensus
 *                      and translated into Audio XX axes.
 *                      Provisional until editorially reviewed.
 *
 *   review_validated   Editorially reviewed products originally
 *                      derived from review synthesis. Validated
 *                      but distinguished from reference-tier
 *                      anchor products.
 *
 *   user_observation   Real listening reports describing system
 *                      interactions. Supporting evidence only —
 *                      does not override product traits.
 *
 *   llm_inference      Temporary interpretation when the system
 *                      encounters products without catalog or
 *                      review-synthesized data.
 *
 * ── Validation status ────────────────────────────────────────────
 *
 *   validated          Editorially reviewed and confirmed.
 *   provisional        Not yet reviewed — usable but lower trust.
 *
 * ── Resolution order (live user path) ────────────────────────────
 *
 *   1. Validated catalog          (reference)
 *   2. Provisional product store  (review_synthesis / review_validated)
 *   3. Brand / family profile
 *   4. Runtime LLM inference      (llm_inference)
 */

import type { ProductCategory, ProductSubcategory, PriceTier, BrandScale, GeoRegion, DesignTopology } from '../catalog-taxonomy';
import type { PrimaryAxisLeanings, FatigueAssessment } from '../axis-types';
import type { ProductTendencies, TendencyProfile } from '../sonic-tendencies';

// ── Provenance model ─────────────────────────────────

/**
 * Source type for a product record.
 *
 * Determines trust level and how the advisory engine frames
 * the product in responses to users.
 */
export type ProvenanceSourceType =
  | 'reference'           // validated catalog anchor — not used here
  | 'review_synthesis'    // derived from review evidence, provisional
  | 'review_validated'    // review-derived, editorially confirmed
  | 'user_observation'    // supporting evidence from listening reports
  | 'llm_inference';      // temporary runtime interpretation

/**
 * Validation status of a product record.
 */
export type ValidationStatus = 'validated' | 'provisional';

/**
 * How well the underlying evidence agrees on the product's character.
 */
export type AgreementLevel = 'strong' | 'mixed' | 'weak';

/**
 * A reference used during synthesis — attribution for auditability.
 */
export interface ProvenanceReference {
  label: string;
  url?: string;
}

/**
 * Complete provenance block for a provisional product.
 *
 * Attached to every non-reference product record. Tracks where the
 * data came from, how confident the synthesis is, and when it was
 * last reviewed.
 */
export interface ProductProvenance {
  sourceType: ProvenanceSourceType;
  confidence: 'high' | 'medium' | 'low';
  validationStatus: ValidationStatus;

  /** Number of independent evidence sources used in synthesis. */
  evidenceCount: number;
  /** Cross-source agreement on the product's sonic character. */
  agreementLevel: AgreementLevel;

  /** Attribution references for the evidence used. */
  references: ProvenanceReference[];

  /** When the synthesis was performed (ISO date string). */
  synthesizedAt: string;
  /** Model identifier used for synthesis (e.g., 'claude-sonnet-4-5-20250929'). */
  modelId?: string;
  /** Editorial explanation of why these axis positions were assigned. */
  rationale: string;

  /** When an editor last reviewed this record (ISO date string). */
  lastReviewedAt?: string;
}

// ── Provisional product record ───────────────────────

/**
 * A provisional product record.
 *
 * Structurally parallel to the validated Product interface but with
 * an explicit provenance block. Lives in the provisional store, not
 * the validated catalog.
 *
 * When a provisional product is promoted to review_validated, it
 * stays in this store with updated provenance — it does NOT move
 * to the validated catalog unless it reaches reference tier.
 */
export interface ProvisionalProduct {
  // ── Core identity ──────────────────────────────────
  id: string;
  brand: string;
  name: string;
  category: ProductCategory;

  /** Approximate price if known. */
  price?: number;
  /** ISO 4217 currency code. Defaults to 'USD' when omitted. */
  priceCurrency?: string;
  /** Architecture / topology description. */
  architecture?: string;

  // ── Catalog diversity metadata (optional) ──────────
  subcategory?: ProductSubcategory;
  priceTier?: PriceTier;
  brandScale?: BrandScale;
  region?: GeoRegion;
  country?: string;
  topology?: DesignTopology;

  // ── Trait model (same axes as validated catalog) ────
  /**
   * Primary axis leanings — the four Audio XX axes.
   * Always present on review-synthesized records.
   */
  primaryAxes: PrimaryAxisLeanings;

  /**
   * Numeric trait scores (0–1 scale).
   * Optional — present when evidence supports granular scoring.
   */
  traits?: Record<string, number>;

  /**
   * Qualitative tendency profile.
   * Present when evidence supports trait-level confidence assessment.
   */
  tendencyProfile?: TendencyProfile;

  /**
   * Structured sonic tendencies (character, interactions, tradeoffs).
   * Present when evidence is rich enough to support structured claims.
   */
  tendencies?: ProductTendencies;

  /** Fatigue assessment if derivable from evidence. */
  fatigueAssessment?: FatigueAssessment;

  // ── Description ────────────────────────────────────
  /** Synthesized description — paraphrased, never copied. */
  description: string;

  /** Source references surfaced in advisory responses. */
  sourceReferences?: Array<{ source: string; note: string; url?: string }>;

  // ── Provenance ─────────────────────────────────────
  /** Always present on provisional products. */
  provenance: ProductProvenance;
}
