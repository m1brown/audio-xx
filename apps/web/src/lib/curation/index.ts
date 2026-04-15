/**
 * Curation layer — public surface for the advisor.
 *
 * The advisor calls getReviewsForProduct() during shortlist build to
 * attach provenance to ProductExample rows. Everything here is pure
 * data — no I/O, no LLM calls, no randomness.
 */

import type { ReviewEntry, Reviewer, ReviewerDomain } from './types';
import { REVIEWS_BY_PRODUCT } from './reviews';
import { REVIEWER_BY_ID, effectiveTier } from './reviewers';

export type { ReviewEntry, Reviewer, ReviewerDomain } from './types';
export { REVIEWERS, REVIEWER_BY_ID, effectiveTier } from './reviewers';
export { REVIEW_ENTRIES, REVIEWS_BY_PRODUCT } from './reviews';

/** Resolved review entry joined with its Reviewer row. Convenient for
 *  the rendering layer and for any tier-based sorting. */
export interface ResolvedReview extends ReviewEntry {
  reviewer: Reviewer;
  /** Effective tier for this review within the product's domain. */
  tierInDomain: ReturnType<typeof effectiveTier>;
}

/** Tier ordering for sorting (lower index = higher authority). */
const TIER_RANK: Record<string, number> = {
  golden: 0,
  trusted: 1,
  community: 2,
  unverified: 3,
};

/**
 * Fetch curated reviews for a product, resolved with reviewer metadata
 * and sorted with highest-authority first within the product's domain.
 *
 * Returns an empty array when the product is not in the curated wedge.
 * The caller MUST treat an empty result as "no provenance available"
 * and fall back to existing behavior — never synthesize attribution.
 */
export function getReviewsForProduct(
  productId: string,
  domain: ReviewerDomain,
): ResolvedReview[] {
  const entries = REVIEWS_BY_PRODUCT[productId];
  if (!entries || entries.length === 0) return [];

  const resolved: ResolvedReview[] = [];
  for (const entry of entries) {
    const reviewer = REVIEWER_BY_ID[entry.reviewerId];
    if (!reviewer) continue; // Unknown reviewer id — skip silently.
    resolved.push({
      ...entry,
      reviewer,
      tierInDomain: effectiveTier(entry.reviewerId, domain),
    });
  }

  // Deterministic ordering:
  //   1. tier-in-domain rank (golden < trusted < community < unverified)
  //   2. year descending (recent reads first)
  //   3. reviewerId ascending (stable, alphabetical tiebreak — matters
  //      for co-primary golden sources like 6moons and Twittering
  //      Machines in the DAC domain, where neither should be collapsed
  //      into the other and ordering must not drift between runs)
  return resolved.sort((a, b) => {
    const ta = TIER_RANK[a.tierInDomain ?? 'unverified'] ?? 3;
    const tb = TIER_RANK[b.tierInDomain ?? 'unverified'] ?? 3;
    if (ta !== tb) return ta - tb;
    if (a.year !== b.year) return b.year - a.year;
    return a.reviewerId.localeCompare(b.reviewerId);
  });
}

/** Convenience: pick the 1–2 highest-authority resolved reviews for card display.
 *  The advisor surfaces at most 2 citations per card to stay uncluttered. */
export function topReviewsForCard(
  productId: string,
  domain: ReviewerDomain,
  max: number = 2,
): ResolvedReview[] {
  return getReviewsForProduct(productId, domain).slice(0, Math.max(1, max));
}
