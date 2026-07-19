/**
 * Audio XX — Catalog lookups.
 *
 * Read-only static-catalog queries over the brand-profile and product
 * arrays. No engine logic, no presentation logic, no LLM calls — these
 * functions are pure filters that take a string and return a row from
 * the catalog (or `undefined` if nothing matches).
 *
 * Layer: **Catalog** (lowest engine layer in the target model). Consumers
 * include the Assessment engine (via consultation.ts), the Inference
 * layer, and presentation surfaces that need to resolve a name into a
 * catalog row at render time (e.g. component cards, brand routes).
 *
 * Dependency direction:
 *   - Imports the static data arrays (BRAND_PROFILES, ALL_PRODUCTS) and
 *     the BrandProfile interface from `consultation.ts` for now. Those
 *     constants will move into this `catalog/` directory in a later
 *     extraction; this commit only moves the **lookup functions** so
 *     the renderer→domain coupling can be broken in one step without
 *     relocating a ~2 200-line data constant.
 *   - Imports `Product` from its current home in `products/dacs.ts`
 *     (a quirk of how the product types were factored — every
 *     category-products file exports the same shared `Product`
 *     interface; consultation.ts already follows the same convention).
 *   - Imports `toSlug` from `route-slug.ts`, aliased as `routeToSlug`
 *     to match the original site of the lookup bodies (byte-identical
 *     behaviour).
 *
 * Cycle note: `consultation.ts` re-exports the five functions defined
 * here as a compatibility shim for non-renderer callers. The resulting
 * module graph is technically cyclic (consultation ↔ catalog/lookups),
 * but the cycle is **benign under ESM**: this file only reads
 * BRAND_PROFILES / ALL_PRODUCTS from inside function bodies (i.e., at
 * call time), never at module-init. Both modules complete initialisation
 * before any lookup is invoked.
 */

import { BRAND_PROFILES, type BrandProfile } from '../consultation';
import { ALL_PRODUCTS } from '../consultation';
import type { Product } from '../products/dacs';
import { toSlug as routeToSlug } from '../route-slug';

/** Look up a brand profile by exact brand name (case-insensitive). */
export function findBrandProfileByName(brandName: string): BrandProfile | undefined {
  const lower = brandName.toLowerCase();
  return BRAND_PROFILES.find((bp) =>
    bp.names.some((name) => name.toLowerCase() === lower),
  );
}

/**
 * Look up a brand profile by URL slug (output of `toSlug`).
 * Used by `/brand/[slug]` to resolve the route segment back to its
 * curated profile. Match is by slug-equivalence on any name in
 * BrandProfile.names — so '/brand/devore' and '/brand/devore-fidelity'
 * both resolve to the same profile.
 */
export function findBrandProfileBySlug(slug: string): BrandProfile | undefined {
  if (!slug) return undefined;
  return BRAND_PROFILES.find((bp) =>
    bp.names.some((name) => routeToSlug(name) === slug),
  );
}

/**
 * Catalog products whose brand slugifies to `slug`. Filters the unified
 * ALL_PRODUCTS pool by exact slug match on `product.brand`, so a brand
 * with multiple BrandProfile aliases (e.g. ['pass labs', 'first watt'])
 * correctly returns only the products matching the URL the user clicked
 * — not the union of every alias.
 */
export function findProductsByBrandSlug(slug: string): Product[] {
  if (!slug) return [];
  return ALL_PRODUCTS.filter((p) => routeToSlug(p.brand) === slug);
}

/**
 * Looser product resolver for prose: returns the first catalog product
 * whose brand AND any distinctive name token (≥4 chars) appears in
 * `text`. Used by the consultation renderer to surface a hero image
 * when the response prose discusses a specific product even though the
 * dispatched subject is brand-only (e.g. "Chord" → "Chord Hugo" once
 * the prose mentions Hugo). 4-char floor avoids false positives from
 * short suffix tokens like "II", "SE", "X".
 */
export function findProductInProse(text: string): Product | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  return ALL_PRODUCTS.find((p) => {
    if (!lower.includes(p.brand.toLowerCase())) return false;
    const tokens = p.name.split(/\s+/).filter((tok) => tok.length >= 4);
    if (tokens.length === 0) {
      // Short model names (e.g. "W5", "W8"): the 4-char filter drops
      // all tokens, so the old logic returned false.  For products
      // whose name has only short tokens, require the brand to be
      // present (already checked) AND the full product name to appear
      // anywhere in the text.  "W5" is short but distinctive enough
      // when combined with the brand-presence gate.
      return lower.includes(p.name.toLowerCase());
    }
    return tokens.some((tok) => lower.includes(tok.toLowerCase()));
  });
}

/**
 * Owner-shorthand model aliases (Phase 2A). Each entry maps a lowercase
 * brand + alias substring to a canonical catalog id. Only add aliases
 * that unambiguously identify one product — never bridge across
 * genuinely different models.
 */
const MODEL_ALIASES: ReadonlyArray<{ brand: string; aliases: string[]; id: string }> = [
  { brand: 'harbeth', aliases: ['shl5+', 'shl5 plus', 'shl5plus', 'super hl5', 'shl5'], id: 'harbeth-shl5-plus' },
  { brand: 'naim', aliases: ['supernait'], id: 'naim-supernait-3' },
  { brand: 'wharfedale', aliases: ['linton'], id: 'wharfedale-linton' },
  { brand: 'klipsch', aliases: ['heresy'], id: 'klipsch-heresy-iv' },
  { brand: 'primaluna', aliases: ['evo 300'], id: 'primaluna-evo-300' },
  { brand: 'focal', aliases: ['kanta'], id: 'focal-kanta-no2' },
  { brand: 'denafrips', aliases: ['pontus'], id: 'denafrips-pontus-ii-12th-1' },
];

/**
 * Look up a single catalog product by a free-form component name such as
 * "WLM Diva Monitor", "JOB Integrated", or "Chord Hugo".
 *
 * Strategy:
 *   1. Exact `brand + " " + name` match (case-insensitive).
 *   2. Contains both brand and full name tokens.
 *   2b. Brand + distinctive-last-token (≥4 chars) — rescues displayed
 *       chain shortenings like "DeVore Orangutan O/96" → "DeVore O/96".
 *   3. ID slug match (hyphen-separated lowercase).
 *
 * Returns `undefined` when no catalog product matches — callers degrade
 * honestly.
 */
export function findProductByComponentName(text: string): Product | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase().trim();
  // 1. Exact brand+name match
  const exact = ALL_PRODUCTS.find(
    (p) => `${p.brand} ${p.name}`.toLowerCase() === lower,
  );
  if (exact) return exact;
  // 2. Contains both brand and full name tokens
  const byTokens = ALL_PRODUCTS.find(
    (p) =>
      lower.includes(p.brand.toLowerCase()) &&
      lower.includes(p.name.toLowerCase()),
  );
  if (byTokens) return byTokens;
  // 2b. Brand + distinctive-last-token match (Phase 2.6 polish,
  //     2026-05-14). The chain rendering sometimes shortens a product
  //     name by omitting the middle word — e.g. "DeVore Orangutan O/96"
  //     becomes "DeVore O/96" in the displayed chain. Step 2 fails
  //     because the input no longer contains the full product name.
  //     This step rescues that case: when the input contains the brand
  //     AND the distinctive last token of the product name (≥4 chars
  //     to avoid noise from short designators like "II" / "SE"), match.
  const byBrandAndDistinctiveToken = ALL_PRODUCTS.find((p) => {
    if (!lower.includes(p.brand.toLowerCase())) return false;
    const tokens = p.name.split(/\s+/);
    const lastToken = tokens[tokens.length - 1].toLowerCase();
    if (lastToken.length < 4) return false;
    return lower.includes(lastToken);
  });
  if (byBrandAndDistinctiveToken) return byBrandAndDistinctiveToken;
  // 2c. Model-alias rescue (Phase 2A) — common shorthand model names that
  //     token matching cannot bridge ("SHL5+" for "Super HL5 Plus",
  //     "SuperNait" without the mark number). Owners use these forms
  //     constantly; without the alias the product entry silently degrades
  //     to brand-level knowledge.
  for (const a of MODEL_ALIASES) {
    if (!lower.includes(a.brand)) continue;
    if (a.aliases.some((al) => lower.includes(al))) {
      const hit = ALL_PRODUCTS.find((p) => p.id === a.id);
      if (hit) return hit;
    }
  }
  // 3. ID slug match (hyphen-separated lowercase)
  const slug = lower.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return ALL_PRODUCTS.find((p) => p.id === slug);
}
