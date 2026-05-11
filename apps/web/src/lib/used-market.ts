/**
 * Used-market awareness — small editorial advisory register.
 *
 * Purpose (Step 5 of 9 — beta path):
 *   When the user's prompt contains explicit used-market framing
 *   (e.g. "used", "second-hand", "pre-owned"), the response should
 *   acknowledge that the question is about acquisition on the used
 *   market — not a new-purchase / MSRP-style description. The main
 *   pipeline (post Step 4) produces correct product identity but
 *   ignores the "used" cue entirely.
 *
 *   This module adds two small pieces:
 *     - `detectUsedFraming(text)` — a regex check the caller invokes
 *       to decide whether to append the advisory.
 *     - `buildUsedMarketNote(product, brand)` — assembles the
 *       advisory block. The block is intentionally generic: it does
 *       not invent current used pricing, does not link to
 *       marketplaces, does not scrape live data. When the product
 *       carries a curated `usedPriceRange` field, that range is
 *       surfaced honestly. Otherwise the response says explicitly
 *       that current used pricing is not known and that the user
 *       should compare the asking price against recent completed
 *       listings rather than MSRP.
 *
 * Out of scope:
 *   - Price database / scraper / live market lookup.
 *   - Marketplace integration / per-region pricing.
 *   - All-brand used-market expansion (catalog data is consulted
 *     when present; nothing is added to the catalog by this step).
 *
 * Engineering-vs-domain boundary (per CLAUDE.md § 8):
 *   This is adapter-layer code. It knows the audio-domain phrase
 *   set ("revision / accessories / remote / PSU / firmware") and
 *   the catalog Product shape. The engine's reasoning primitives
 *   are untouched.
 */

import type { Product } from './products/dacs';

// ── Detector ─────────────────────────────────────────────────────────

/**
 * Lowercase phrases that signal the user is asking about a used /
 * second-hand purchase. Kept narrow on purpose — we do not want to
 * trip on "previously" in unrelated contexts. Each pattern requires
 * at least one acquisition-context cue (used, pre-owned, etc.) to
 * fire.
 */
const USED_FRAMING_PATTERNS: ReadonlyArray<RegExp> = [
  /\bused\s+(?:market|price|pricing|condition|copy|unit|sample|one)\b/i,
  /\bused\s+(?:[a-z][a-z0-9' -]+\s+)?(?:a\s+)?good\s+(?:buy|deal|price|value)\b/i,
  /\bbuy(?:ing)?\s+used\b/i,
  /\bbuying\s+(?:on\s+)?(?:the\s+)?used\s+market\b/i,
  /\bsecond[-\s]?hand\b/i,
  /\bpre[-\s]?owned\b/i,
  /\bpreviously\s+owned\b/i,
  /\bon\s+the\s+used\s+market\b/i,
  /\bused\s+market\b/i,
  // "is a used X a good buy/deal/price/value/idea" — the audit's P8 form
  /\bis\s+(?:a|an|the)\s+used\s+\b/i,
  // "considering a used X" / "looking at a used X"
  /\b(?:considering|looking\s+(?:at|for)|eyeing)\s+(?:a\s+|an\s+|the\s+)?used\b/i,
];

export function detectUsedFraming(text: string | null | undefined): boolean {
  if (!text) return false;
  return USED_FRAMING_PATTERNS.some((p) => p.test(text));
}

// ── Note builder ─────────────────────────────────────────────────────

/**
 * Render the used-market advisory block. The block is composed of
 * three short paragraphs:
 *
 *   1. Acknowledgment + pricing-data scope (uses curated
 *      `usedPriceRange` if present; otherwise states explicitly
 *      that current used pricing isn't known).
 *   2. What to check before buying — concrete due-diligence list
 *      tuned for audio components.
 *   3. How to think about value — compare against recent completed
 *      listings rather than MSRP; consider alternatives the user
 *      may not have weighed.
 *
 * Returns a plain string with double newlines between paragraphs.
 * The caller decides where in the response to inject it. No
 * markdown beyond the existing convention used by the consultation
 * builders.
 */
export function buildUsedMarketNote(
  product: Product | null | undefined,
  brandName: string | null | undefined,
): string {
  const productName = product
    ? `${product.brand} ${product.name}`
    : brandName ?? 'this product';

  const parts: string[] = [];

  // ── 1. Acknowledgment + pricing scope ────────────
  const pricingLine = (() => {
    if (product?.availability === 'discontinued' && product.usedPriceRange) {
      const { low, high } = product.usedPriceRange;
      return `${productName} is discontinued — typical used-market range is $${low}–$${high}, varying by region, condition, and accessories.`;
    }
    if (product?.usedPriceRange) {
      const { low, high } = product.usedPriceRange;
      return `Curated used-market range for ${productName} is approximately $${low}–$${high}, but exact pricing varies by region, revision, condition, accessories, and timing. I don't have live market data — verify against recent completed listings rather than asking prices.`;
    }
    if (product?.price) {
      return `Retail (new) is approximately $${product.price.toLocaleString()}. I don't have current used-market pricing for ${productName}, and used prices vary significantly by region, revision, condition, accessories, and timing. Compare any asking price against recent completed listings rather than MSRP — sold prices are the more reliable signal.`;
    }
    return `I don't have current used-market pricing for ${productName}. Used prices vary by region, revision, condition, accessories, and timing — compare any asking price against recent completed listings rather than MSRP.`;
  })();
  parts.push(`**Used-market context.** ${pricingLine}`);

  // ── 2. What to check before buying ───────────────
  const checks: string[] = [];
  // Revision/version cue — relevant for DACs, streamers, anything with hardware revisions or firmware.
  checks.push(
    'Revision / version — many DAC and streamer lines have multiple revisions with audible or feature differences; confirm exactly which version is being sold.',
  );
  // Tubes — only when the product is tube-output / tube-using.
  const isTube = product?.topology === 'tube'
    || (product?.architecture ?? '').toLowerCase().includes('tube')
    || (product?.description ?? '').toLowerCase().includes('tube');
  if (isTube) {
    checks.push(
      'Tube hours and condition — used tube products carry maintenance considerations; ask about hours on the current tube set, recent replacements, and whether spares are included.',
    );
  }
  // Accessories — applies broadly.
  checks.push(
    'Accessories — remote, original power supply, packaging, and cables affect both resale value and convenience. Missing items are normal; confirm what is and isn\'t included.',
  );
  // Operational state.
  checks.push(
    'Operational status — confirmed working across all inputs/outputs, no DOA risk, channel balance is even, and (where applicable) firmware is current.',
  );
  // Seller / shipping / return.
  checks.push(
    'Seller and shipping — established seller history, return policy, and shipping risk (international shipping on heavy or fragile units adds meaningful cost and damage probability).',
  );
  // Provenance.
  checks.push(
    'Proof of ownership — receipt or original purchase proof reduces grey-market and warranty-transfer ambiguity, particularly on higher-priced gear.',
  );
  parts.push(`**Before buying, confirm.**\n- ${checks.join('\n- ')}`);

  // ── 3. How to think about value ──────────────────
  const valueLines: string[] = [];
  valueLines.push(
    'Compare the asking price against **recent completed listings** (sold, not asked) on used-audio venues. Asking prices tend to drift; sold prices reflect what the market actually clears.',
  );
  valueLines.push(
    `Decide value relative to alternatives — for ${productName}, that usually means weighing the next product up and down in the same family, plus one or two cross-family alternatives in the same price band. A good used price beats a marginal new alternative; a poor used price loses to a slightly more expensive new unit with warranty.`,
  );
  parts.push(`**How to read value.**\n- ${valueLines.join('\n- ')}`);

  return parts.join('\n\n');
}
