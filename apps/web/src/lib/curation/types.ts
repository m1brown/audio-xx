/**
 * Curation layer — foundational types for phase 1.
 *
 * Scope: tube amps and DACs only. This is a narrow wedge by design.
 * Do NOT expand to the whole catalog without an explicit phase-2 decision.
 *
 * Principles:
 *   - Sources are INPUTS, not outputs. We never reproduce full reviews.
 *   - Quotes are minimal (≤15 words) and always attributed.
 *   - Every ReviewEntry carries a working URL to the original.
 *   - The advisor synthesizes across sources; it does not imitate any voice.
 *   - Everything here is deterministic static data, reviewable in diff.
 */

// ── Reviewer registry ─────────────────────────────────

/** Source tier. Determines authority in conflicts and eligibility as a
 *  load-bearing citation. Tier is a human decision, not derived from metrics. */
export type ReviewerTier = 'golden' | 'trusted' | 'community' | 'unverified';

/** Product domains within which a reviewer's judgment is treated as
 *  load-bearing. A reviewer can be `golden` in one domain and `trusted`
 *  in another — authority is scoped, not universal. */
export type ReviewerDomain =
  | 'tube-amp'
  | 'solid-state-amp'
  | 'dac'
  | 'speaker'
  | 'headphone'
  | 'turntable'
  | 'cartridge'
  | 'streamer'
  | 'cable'
  | 'general';

export interface Reviewer {
  /** Stable slug. Used as foreign key from ReviewEntry. */
  id: string;
  displayName: string;
  publication: string;
  /** Default tier when no domain override applies. */
  tier: ReviewerTier;
  /** Domain-scoped tier overrides. A reviewer may be 'golden' in
   *  `tube-amp` but 'trusted' in `solid-state-amp`. */
  domainTiers?: Partial<Record<ReviewerDomain, ReviewerTier>>;
  /** Domains where this reviewer is considered a primary authority. */
  areasOfAuthority: ReviewerDomain[];
  /** Homepage — not used for citations, but useful for registry lookups. */
  homepageUrl?: string;
  /** Why this tier. Reviewable rationale. */
  notes?: string;
}

// ── Review entries ────────────────────────────────────

/** A single review of a single product by a single reviewer.
 *  Multiple entries per product are expected and encouraged. */
export interface ReviewEntry {
  /** Stable id: `${productId}:${reviewerId}` works well. */
  id: string;
  /** Catalog product id (must match an entry in apps/web/src/lib/products). */
  productId: string;
  /** Reviewer registry id. */
  reviewerId: string;
  /** Publication year. Reviews age; context matters. */
  year: number;
  /** Direct URL to the original piece. MUST be working — missing or
   *  placeholder URLs fail the credibility policy. */
  url: string;
  /** Short attributed quote. Hard cap: 15 words. Fair use only. */
  shortQuote: string;
  /** Archetype tags this review's sonic reading implies. Used by the
   *  advisor when synthesizing across sources. Values match the
   *  catalog archetype vocabulary. */
  sonicTags: string[];
  /** One-line editorial synthesis written in Audio XX voice. This is
   *  what the advisor surfaces when the reviewer's own words are not
   *  directly quoted. MUST NOT paraphrase review sentences closely. */
  synthesis: string;
  /** Optional: system pairing used in the review. Important context
   *  when a reviewer's verdict is pairing-dependent. */
  pairingContext?: string;
}

// ── Saved system (minimal schema, no UI yet) ──────────

/** Minimal stub for the saved-system model. Schema only — no persistence
 *  layer in this phase. Listed here so the curation and system layers
 *  share a vocabulary from day one. */
export interface SavedSystem {
  id: string;
  userId: string;
  label: string;
  role: 'primary' | 'desktop' | 'headphone' | 'secondary';
  createdAt: number;
  updatedAt: number;
  components: Array<{
    slot: 'source' | 'dac' | 'pre' | 'power' | 'integrated'
        | 'speaker' | 'headphone' | 'cartridge' | 'cable';
    productId?: string;
    freeText?: string;
    status: 'current' | 'evaluating' | 'sold' | 'parked';
  }>;
  room?: {
    sizeApprox?: 'small' | 'medium' | 'large';
    treatment?: 'none' | 'light' | 'moderate' | 'heavy';
  };
}

// ── Sonic preference profile (minimal schema, no persistence yet) ──

export interface SonicPreferenceProfile {
  id: string;
  userId: string;
  label: string;
  createdAt: number;
  updatedAt: number;
  /** What they want more of. Trait → signed weight. */
  priorities: Record<string, number>;
  /** What they want less of. Trait → signed weight. */
  avoidances: Record<string, number>;
  /** Fatigue / harshness / bloat tolerances (0–1). */
  tolerances?: {
    harshness?: number;
    bassBloat?: number;
    edge?: number;
    fatigue?: number;
  };
  /** Archetype affinity, normalized. Drives default archetype matching
   *  when no explicit query signal is present. */
  archetypeAffinity?: Record<string, number>;
  /** Confidence in the current profile. Gates how assertive the advisor
   *  allows itself to be. */
  confidence: 'anchored' | 'forming' | 'exploratory';
}
