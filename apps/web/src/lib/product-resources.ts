/**
 * "Product Resources" — the compact commerce block closing a response.
 *
 * Three rows per recognized product: Manufacturer, Buy New, Used Market.
 * Anything that cannot be built safely is omitted rather than guessed, so
 * a product with no manufacturer URL simply shows fewer rows, and a product
 * that is not in the catalog shows none at all.
 *
 * All link construction goes through `buildProductLinks`, which owns the
 * affiliate tagging, the used-only gating and the per-brand Amazon
 * exclusions. This module does not build URLs; it selects and labels the
 * first link of each kind so the block stays compact.
 *
 * Commerce is subordinate to editorial by construction: the caller decides
 * whether to render this at all, and the formats that already show purchase
 * links per product pass nothing in (see `ResponseFooter`).
 */
import { findProductByComponentName } from '@/lib/catalog/lookups';
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
 * Marketplaces and used-gear aggregators.
 *
 * `buildProductLinks` derives its manufacturer link as "the first retailer
 * link that is neither Amazon nor a known dealer", which lets an aggregator
 * through — the JOB Integrated entry's first retailer link is a HiFi Shark
 * search, and it rendered here under the label "Manufacturer". Mislabelling
 * a used-listing search as the maker's own page is exactly the kind of
 * small dishonesty this block cannot afford, so a manufacturer link that
 * resolves to one of these is dropped instead.
 */
const NOT_A_MANUFACTURER = [
  'hifishark.com', 'ebay.', 'amazon.', 'audiogon.com', 'usaudiomart.com',
  'canuckaudiomart.com', 'reverb.com', 'etsy.com', 'aliexpress.',
];

function isManufacturerUrl(url: string): boolean {
  const u = url.toLowerCase();
  return !NOT_A_MANUFACTURER.some((host) => u.includes(host));
}

export function buildProductResources(input: ProductResourcesInput): ProductResource[] {
  const out: ProductResource[] = [];
  const seen = new Set<string>();

  for (const name of input.componentNames ?? []) {
    if (!name?.trim() || out.length >= MAX_PRODUCTS) continue;
    const product = findProductByComponentName(name);
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
      // Same guard on the input side: retailer_links[0] is frequently an
      // aggregator, and feeding it in as `manufacturerUrl` would reintroduce
      // the mislabel through buildProductLinks' own fallback.
      manufacturerUrl:
        product.learnMore?.manufacturer
        ?? product.retailer_links?.map((l) => l.url).find(isManufacturerUrl),
      usedMarketUrl: product.learnMore?.usedMarket,
    });

    const links: ProductResourceLink[] = [];
    const manufacturer = resolved.manufacturerLinks.find((l) => isManufacturerUrl(l.url));
    if (manufacturer) {
      links.push({ label: 'Manufacturer', url: manufacturer.url });
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
