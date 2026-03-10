/**
 * Knowledge layer types — shared by brand and product schemas.
 *
 * These types define the curation model, source provenance,
 * link structure, and dealer/distributor entries.
 */

// ── Curation ─────────────────────────────────────────

/** Curation lifecycle status. */
export type CurationStatus = 'draft' | 'reviewed' | 'approved';

/**
 * Curation metadata attached to every knowledge entry.
 * Tracks provenance, review state, and editorial notes.
 */
export interface CurationMeta {
  /** Current lifecycle status. */
  status: CurationStatus;
  /** Who created the initial draft. */
  draftedBy: 'ai' | 'human';
  /** ISO date when the draft was created. */
  draftedAt: string;
  /** Who reviewed the entry (your name/handle). */
  reviewedBy?: string;
  /** ISO date of review. */
  reviewedAt?: string;
  /** ISO date when promoted to approved. */
  approvedAt?: string;
  /** Free-form editorial notes from the review process. */
  notes?: string;
}

// ── Sources ──────────────────────────────────────────

/** A publication or reviewer source basis. */
export interface SourceEntry {
  /** Publication name (e.g. "6moons", "Stereophile"). */
  publication: string;
  /** Optional specific reviewer name. */
  reviewer?: string;
  /** URL to the specific review or article. */
  url?: string;
  /** What kind of source this is. */
  kind: 'review' | 'measurement' | 'interview' | 'manufacturer' | 'forum_consensus';
  /** Free-form note about what this source covers. */
  note?: string;
}

// ── Links ────────────────────────────────────────────

/** A structured link with clear labeling. */
export interface KnowledgeLink {
  /** Display label (e.g. "Official website", "6moons review"). */
  label: string;
  /** Full URL. */
  url: string;
  /** Link kind — determines rendering group and any disclaimer. */
  kind: 'official' | 'dealer' | 'review' | 'reference';
  /** ISO region code or broad label (e.g. 'US', 'EU', 'global'). */
  region?: string;
}

// ── Dealers / Distributors ───────────────────────────

/** A dealer or distributor entry — international by default. */
export interface DealerEntry {
  /** Business name. */
  name: string;
  /** Broad region (e.g. 'US', 'EU', 'Asia-Pacific'). */
  region: string;
  /** ISO 3166-1 country code or name (e.g. 'US', 'UK', 'Germany'). */
  country?: string;
  /** City, if useful for context. */
  city?: string;
  /** Dealer website URL. */
  url?: string;
  /** Whether this is a national importer/distributor vs a local dealer. */
  role?: 'distributor' | 'dealer';
}

// ── Product families ─────────────────────────────────

/** A major product family or lineage within a brand. */
export interface ProductFamily {
  /** Family name (e.g. "Orangutan (O) series"). */
  name: string;
  /** One-line character description. */
  character: string;
  /** Optional amplifier-pairing note. */
  ampPairing?: string;
  /** Approximate price range, if useful for orientation. */
  priceRange?: string;
}
