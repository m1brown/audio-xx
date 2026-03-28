/**
 * Audio XX — Amazon Affiliate Link Helper
 *
 * Generates Amazon search URLs with an affiliate tag.
 * Used as a supplementary buying source alongside manufacturer
 * and dealer links — never prioritized or ranked above them.
 *
 * URL strategy:
 *   - Search-based links (not direct product links) to avoid
 *     stale ASINs and inventory mismatches.
 *   - Affiliate tag appended as query parameter.
 *   - Category scoped to "Electronics" (node 172282) for relevance.
 *
 * Products that should NOT get Amazon links:
 *   - Discontinued / vintage / used-only products
 *   - Boutique products with no Amazon distribution (e.g. Decware, Leben)
 *   - Products where direct-from-manufacturer is the only channel
 */

// ── Configuration ────────────────────────────────────

/** Amazon Associates store ID. Change this to your own tag. */
const AFFILIATE_TAG = 'audioxx-20';

/** Amazon search base URL (US store). */
const AMAZON_SEARCH_BASE = 'https://www.amazon.com/s';

/** Electronics category node for scoped search. */
const ELECTRONICS_NODE = '172282';

// ── Exclusion list ───────────────────────────────────
// Brands known to have no meaningful Amazon presence for audio gear.
// These sell exclusively through their own site or authorized dealers.
const AMAZON_EXCLUDED_BRANDS = new Set([
  'decware',
  'linear tube audio',
  'leben',
  'devore',
  'devore fidelity',
  'boenicke',
  'first watt',
  'job',           // Goldmund sub-brand, discontinued
  'scott',         // Vintage — no new product on Amazon
  'quad',          // Limited Amazon presence for tube amps
]);

// ── Public API ───────────────────────────────────────

/**
 * Determine whether a product should get an Amazon link.
 * Returns false for excluded brands, discontinued products,
 * and used-only items.
 */
export function shouldShowAmazonLink(opts: {
  brand?: string;
  availability?: 'current' | 'discontinued' | 'vintage';
  typicalMarket?: 'new' | 'used' | 'both';
  buyingContext?: string;
}): boolean {
  // No Amazon for discontinued / vintage / used-only
  if (opts.availability === 'discontinued' || opts.availability === 'vintage') return false;
  if (opts.typicalMarket === 'used') return false;
  if (opts.buyingContext === 'used_only') return false;

  // No Amazon for excluded brands
  if (opts.brand && AMAZON_EXCLUDED_BRANDS.has(opts.brand.toLowerCase())) return false;

  return true;
}

/**
 * Build an Amazon search URL with affiliate tag.
 * Scoped to the Electronics category for relevance.
 *
 * @param name    - Product name (e.g. "Bifrost 2/64")
 * @param brand   - Brand name (e.g. "Schiit")
 * @returns       - Full Amazon search URL with affiliate tag
 */
export function getAmazonSearchUrl(name: string, brand?: string): string {
  const query = [brand, name].filter(Boolean).join(' ');
  const params = new URLSearchParams({
    k: query,
    i: 'electronics',
    rh: `n:${ELECTRONICS_NODE}`,
    tag: AFFILIATE_TAG,
  });
  return `${AMAZON_SEARCH_BASE}?${params.toString()}`;
}

/**
 * Get the affiliate tag (for display or debugging).
 */
export function getAffiliateTag(): string {
  return AFFILIATE_TAG;
}
