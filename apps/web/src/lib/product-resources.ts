/**
 * "Product Resources" — the compact commerce block closing a response.
 *
 * Three rows per recognized product: Manufacturer, Buy New, Used Market.
 * Anything that cannot be built safely is omitted rather than guessed, so
 * a product with no manufacturer URL simply shows fewer rows, and a product
 * that is not in the catalog shows none at all.
 *
 * All link construction goes through `buildProductLinks`, which owns the
 * affiliate tagging, the used-only gating, the per-brand Amazon exclusions
 * and the marketplace/aggregator exclusion that keeps a used-listings search
 * from being labelled as the maker's own page. This module does not build or
 * classify URLs; it selects and labels the first link of each kind so the
 * block stays compact.
 *
 * Commerce is subordinate to editorial by construction: the caller decides
 * whether to render this at all, and the formats that already show purchase
 * links per product pass nothing in (see `ResponseFooter`).
 */
import { findProductByComponentName } from '@/lib/catalog/lookups';
import { HEADPHONE_PRODUCTS } from '@/lib/products/headphones';
import { buildProductLinks } from '@/lib/product-links';

export interface ProductResourceLink {
  label: 'Manufacturer' | 'Buy New' | 'Used Market';
  url: string;
}

export interface ProductResource {
  /** "Chord Hugo" — brand and model, as catalogued. */
  title: string;
  links: ProductResourceLink[];
}

export interface ProductResourcesInput {
  /** Product / component names named this turn. */
  componentNames?: string[];
}

const MAX_PRODUCTS = 6;

/**
 * The headphone selector appends a form-factor label to the display name
 * ("Aria 2 [IEM]", "Ananda [over-ear, wireless]"). Catalog lookup must see
 * the catalogued name, not the label.
 */
function stripFormFactorLabel(name: string): string {
  return name.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Headphones and IEMs live in their own catalog and are NOT part of
 * `ALL_PRODUCTS`, so `findProductByComponentName` can never resolve them —
 * which meant every headphone and IEM recommendation rendered with no
 * purchase links at all (founder-reported, 2026-08-13).
 *
 * Resolved here rather than by widening `ALL_PRODUCTS`: that pool also feeds
 * brand-page lookups, Subject Card resolution and the cross-brand leakage
 * invariant, and this defect does not justify moving it. Match is exact on
 * "brand name" or on the bare model, never a loose substring, so a short
 * model name cannot collide with an unrelated product.
 */
function findHeadphoneByName(text: string): (typeof HEADPHONE_PRODUCTS)[number] | undefined {
  const q = norm(stripFormFactorLabel(text));
  if (!q) return undefined;
  return HEADPHONE_PRODUCTS.find((p) => {
    const full = norm(`${p.brand} ${p.name}`);
    const bare = norm(p.name);
    return q === full || q === bare;
  });
}

export function buildProductResources(input: ProductResourcesInput): ProductResource[] {
  const out: ProductResource[] = [];
  const seen = new Set<string>();

  for (const name of input.componentNames ?? []) {
    if (!name?.trim() || out.length >= MAX_PRODUCTS) continue;
    const cleaned = stripFormFactorLabel(name);
    const product = findProductByComponentName(cleaned) ?? findHeadphoneByName(name);
    // Not in the catalog: no resource row. We do not synthesise a search
    // link for a product we cannot confirm exists.
    if (!product) continue;

    const title = `${product.brand} ${product.name}`.trim();
    if (seen.has(title)) continue;
    seen.add(title);

    const resolved = buildProductLinks({
      name: product.name,
      brand: product.brand,
      retailerLinks: product.retailer_links,
      availability: product.availability,
      manufacturerUrl: product.learnMore?.manufacturer ?? product.retailer_links?.[0]?.url,
      usedMarketUrl: product.learnMore?.usedMarket,
    });

    const links: ProductResourceLink[] = [];
    // buildProductLinks excludes marketplaces and aggregators from
    // manufacturerLinks, so anything here is safe to label "Manufacturer".
    if (resolved.manufacturerLinks[0]) {
      links.push({ label: 'Manufacturer', url: resolved.manufacturerLinks[0].url });
    }
    // Discontinued and vintage products produce no new-market links at all;
    // buildProductLinks already suppresses them, so this is simply empty.
    if (resolved.newLinks[0]) {
      links.push({ label: 'Buy New', url: resolved.newLinks[0].url });
    }
    if (resolved.usedLinks[0]) {
      links.push({ label: 'Used Market', url: resolved.usedLinks[0].url });
    }

    if (links.length > 0) out.push({ title, links });
  }

  return out;
}
