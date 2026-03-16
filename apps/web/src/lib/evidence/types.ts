/**
 * Evidence Store — Types.
 *
 * The evidence store holds curated source material for products not yet
 * in the validated Audio XX catalog. Each record accumulates paraphrased
 * observations from approved review sources until there is enough
 * evidence for LLM-assisted trait synthesis.
 *
 * Design principles:
 *   - No verbatim review text — summaries and paraphrases only.
 *   - Source attribution preserved for auditability.
 *   - Evidence quality explicitly tracked via reliability and agreement.
 *   - Separation between evidence gathering (this layer) and trait
 *     synthesis (provisional layer).
 */

import type { ProductCategory } from '../catalog-taxonomy';

// ── Sonic observation ────────────────────────────────

/**
 * Perceptual domain for a sonic observation.
 *
 * Maps broadly to the four Audio XX axes plus supplementary
 * dimensions that inform trait scoring:
 *   tonality  → warm_bright axis
 *   texture   → smooth_detailed axis
 *   dynamics  → elastic_controlled axis
 *   spatial   → airy_closed axis
 *   timing    → cross-axis (speed, articulation)
 *   fatigue   → system-outcome overlay
 *   general   → observations that span multiple domains
 */
export type ObservationDomain =
  | 'tonality'
  | 'timing'
  | 'spatial'
  | 'dynamics'
  | 'texture'
  | 'fatigue'
  | 'general';

/**
 * A single sonic observation extracted from a review source.
 *
 * Always paraphrased — never a direct quotation.
 * The domain tag helps the synthesis step map observations
 * to the correct Audio XX axis.
 */
export interface SonicObservation {
  domain: ObservationDomain;
  /** Paraphrased summary of the observation. */
  summary: string;
}

// ── Evidence source ──────────────────────────────────

/**
 * Classification of the evidence source.
 *
 *   professional_review  — published review from a recognized outlet
 *   forum_consensus      — recurring pattern across community discussion
 *   measurement          — objective measurement data (e.g., ASR, Stereophile)
 *   manufacturer         — stated design intent from the manufacturer
 */
export type EvidenceSourceKind =
  | 'professional_review'
  | 'forum_consensus'
  | 'measurement'
  | 'manufacturer';

/**
 * A single evidence source with its extracted observations.
 *
 * Each source represents one independent input to the synthesis
 * process. The system requires at least two independent sources
 * before considering evidence sufficient for synthesis.
 */
export interface EvidenceSource {
  /** Unique identifier for this source entry. */
  id: string;
  kind: EvidenceSourceKind;
  /** Human-readable title (e.g., "Stereophile review, Jan 2024"). */
  title: string;
  /** Source URL for attribution. */
  url?: string;
  /** Publication or community name. */
  publication?: string;
  /** Approximate date of the source material (ISO date string). */
  date?: string;
  /** Paraphrased sonic observations extracted from this source. */
  observations: SonicObservation[];
  /** Editorial assessment of source reliability. */
  reliability: 'high' | 'medium' | 'low';
  /** When this source was added to the evidence store. */
  addedAt: string;
}

// ── Evidence record ──────────────────────────────────

/**
 * Readiness status for synthesis.
 *
 *   pending      — evidence is being gathered, not yet enough for synthesis
 *   sufficient   — enough evidence to attempt LLM synthesis
 *   insufficient — evaluated and found too thin for reliable synthesis
 */
export type EvidenceStatus = 'pending' | 'sufficient' | 'insufficient';

/**
 * Complete evidence record for a single product.
 *
 * Accumulates sources over time. Once status reaches 'sufficient',
 * the record can be fed to the synthesis pipeline to produce a
 * ProvisionalProduct record.
 *
 * Sufficiency criteria:
 *   - Observations covering at least 3 of the 4 Audio XX axes
 *   - At least 2 independent sources
 *   - No unresolvable contradictions in core axis positions
 */
export interface EvidenceRecord {
  /** Slugified product identifier (e.g., 'marantz-2220b'). */
  productId: string;
  /** Display name of the product. */
  productName: string;
  /** Brand name. */
  brand: string;
  /** Product category. */
  category: ProductCategory;
  /** Approximate price if known. */
  price?: number;
  /** Known architecture / topology if available from sources. */
  architecture?: string;

  /** Accumulated evidence sources. */
  sources: EvidenceSource[];

  /**
   * Whether review sources broadly agree on the product's character.
   *
   *   strong — sources converge on the same sonic description
   *   mixed  — some disagreement but a majority direction is discernible
   *   weak   — contradictory or insufficient pattern to establish direction
   */
  agreementLevel: 'strong' | 'mixed' | 'weak';

  /** Readiness for synthesis. */
  status: EvidenceStatus;

  /** When this evidence record was created. */
  createdAt: string;
  /** When this evidence record was last modified. */
  updatedAt: string;
}
