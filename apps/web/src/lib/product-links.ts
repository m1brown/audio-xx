/**
 * Audio XX — Deterministic Product Link Builder
 *
 * Generates a prioritized, deduplicated set of buying links for each product card.
 *
 * Link classification:
 *   "Buy new" — ecommerce / dealer links only:
 *     1. Authorized dealer (if available in retailer_links)
 *     2. Amazon direct (only if verified ASIN exists in retailer_links)
 *   "Product page" — manufacturer / brand info pages (not ecommerce):
 *     3. Manufacturer / brand site (informational, always available as fallback)
 *
 * Link priority (used purchase):
 *   1. HiFi Shark (global aggregator)
 *   2. eBay (filtered search)
 *   3. Additional used sources from catalog (Audiogon, US Audio Mart, etc.)
 *
 * Rules:
 *   - No Amazon link unless the product has a verified ASIN in catalog data
 *   - No duplicate URLs across any section
 *   - At least one link always appears in "Buy new" or "Find used"
 *   - Search-based Amazon links are never generated — only direct catalog links
 */

import { shouldShowAmazonLink } from './amazon-links';

// ── Types ────────────────────────────────────────────

export interface ProductLinkInput {
  name: string;
  brand?: string;
  /** All retailer links from the product catalog. */
  retailerLinks?: Array<{ label: string; url: string; region?: string }>;
  /** Structured links with kind metadata (from advisory layer). */
  advisoryLinks?: Array<{ label: string; url: string; kind?: 'reference' | 'dealer' | 'review' }>;
  /** Market availability status. */
  availability?: 'current' | 'discontinued' | 'vintage';
  /** Where this product is typically found. */
  typicalMarket?: 'new' | 'used' | 'both';
  /** Structured buying context from catalog. */
  buyingContext?: string;
  /** Manufacturer URL fallback (retailer_links[0].url from catalog). */
  manufacturerUrl?: string;
  /** Pre-computed used-market URL from catalog. */
  usedMarketUrl?: string;
  /** Additional used-market sources from catalog. */
  usedMarketSources?: Array<{ name: string; url: string; region: string }>;
}

export interface ResolvedLink {
  label: string;
  url: string;
}

export interface ProductLinks {
  /** "Buy new" links — dealer / ecommerce only, never manufacturer product pages. */
  newLinks: ResolvedLink[];
  /** Manufacturer product/info pages — labeled "Product page", not "Buy new". */
  manufacturerLinks: ResolvedLink[];
  /** "Buy used" / "Find used" links — hifishark → ebay → extras. */
  usedLinks: ResolvedLink[];
  /** "Further reading" links — reviews, references. */
  readingLinks: ResolvedLink[];
  /** Whether the product is used-only (discontinued/vintage/used market). */
  isUsedOnly: boolean;
  /** True if a verified Amazon ASIN was found in catalog data. */
  hasVerifiedAmazon: boolean;
}

// ── URL builders ─────────────────────────────────────

function hifiSharkUrl(brand: string | undefined, name: string): string {
  const query = [brand, name].filter(Boolean).join(' ');
  return `https://www.hifishark.com/search?q=${encodeURIComponent(query)}`;
}

function ebayUrl(brand: string | undefined, name: string): string {
  const query = [brand, name].filter(Boolean).join(' ');
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sacat=293&LH_All=1`;
}

// ── Detection helpers ────────────────────────────────

/** True if the URL is a direct Amazon product link (contains /dp/ ASIN). */
function isVerifiedAmazonLink(url: string): boolean {
  return /amazon\.com\/dp\/[A-Z0-9]{10}/i.test(url);
}

/** True if the label or URL indicates an Amazon link. */
function isAmazonLink(label: string, url: string): boolean {
  return label.toLowerCase() === 'amazon' || url.includes('amazon.com');
}

/** True if the label indicates a known third-party dealer (not manufacturer, not Amazon). */
function isDealerLink(label: string, url: string): boolean {
  const lower = label.toLowerCase();
  // Exclude manufacturer self-links and Amazon
  if (isAmazonLink(label, url)) return false;
  // Known dealer patterns
  const dealerPatterns = [
    'apos audio', 'crutchfield', 'audio advisor', 'music direct',
    'needle doctor', 'moon audio', 'headphones.com', 'adorama',
    'b&h', 'world wide stereo', 'safe and sound', 'echo audio',
    'vinshine', 'upscale audio', 'the music room',
  ];
  if (dealerPatterns.some(p => lower.includes(p))) return true;
  if (lower.includes('dealer') || lower.includes('buy')) return true;
  return false;
}

/** True if the label indicates a review or reference link. */
function isReadingLink(label: string): boolean {
  const lower = label.toLowerCase();
  return lower.includes('review') || lower.includes('reference') || lower.includes('read');
}

// ── Main builder ─────────────────────────────────────

/**
 * Build a prioritized, deduplicated set of product links.
 * Deterministic: same input always produces same output.
 */
export function buildProductLinks(input: ProductLinkInput): ProductLinks {
  const isDiscontinued = input.availability === 'discontinued' || input.availability === 'vintage';
  const isUsedOnly = isDiscontinued || input.typicalMarket === 'used';

  const allRetailer = input.retailerLinks ?? [];
  const allAdvisory = input.advisoryLinks ?? [];

  // Track URLs we've already added to prevent duplicates
  const seenUrls = new Set<string>();
  const addIfNew = (list: ResolvedLink[], label: string, url: string): boolean => {
    if (!url || seenUrls.has(url)) return false;
    seenUrls.add(url);
    list.push({ label, url });
    return true;
  };

  // ── Detect verified Amazon ──
  const amazonEntry = allRetailer.find(l => isAmazonLink(l.label, l.url));
  const hasVerifiedAmazon = !!(amazonEntry && isVerifiedAmazonLink(amazonEntry.url));

  // ── Should we show Amazon at all? ──
  const amazonEligible = hasVerifiedAmazon && shouldShowAmazonLink({
    brand: input.brand,
    availability: input.availability,
    typicalMarket: input.typicalMarket,
    buyingContext: input.buyingContext,
  });

  // ── Build "Buy new" links ──
  const newLinks: ResolvedLink[] = [];

  if (!isUsedOnly) {
    // Priority 1: Authorized dealers from retailer_links
    for (const l of allRetailer) {
      if (isDealerLink(l.label, l.url)) {
        addIfNew(newLinks, l.label, l.url);
      }
    }
    // Also check advisory links for dealer kind
    for (const l of allAdvisory) {
      if (l.kind === 'dealer') {
        const cleanLabel = l.label.replace(/^buy\s+new\s*[-—–]\s*/i, '');
        addIfNew(newLinks, cleanLabel, l.url);
      }
    }

    // Priority 2: Amazon direct link (only if verified ASIN exists)
    if (amazonEligible && amazonEntry) {
      addIfNew(newLinks, 'Amazon', amazonEntry.url);
    }

  }

  // ── Build manufacturer / product-page links ──
  // These are brand product pages — informational, not ecommerce.
  // Separated from "Buy new" so the UI can label them "Product page".
  const manufacturerLinks: ResolvedLink[] = [];

  {
    // First try: non-Amazon, non-dealer retailer link (typically the brand's own site)
    const manufacturerEntry = allRetailer.find(l =>
      !isAmazonLink(l.label, l.url) && !isDealerLink(l.label, l.url),
    );
    if (manufacturerEntry) {
      addIfNew(manufacturerLinks, input.brand ?? 'Manufacturer', manufacturerEntry.url);
    } else if (input.manufacturerUrl) {
      // Fallback: pre-computed manufacturerUrl (retailer_links[0].url)
      addIfNew(manufacturerLinks, input.brand ?? 'Manufacturer', input.manufacturerUrl);
    }
  }

  // ── Build "Buy used" links ──
  const usedLinks: ResolvedLink[] = [];

  // Priority 1: HiFi Shark
  const hifiShark = input.usedMarketUrl ?? hifiSharkUrl(input.brand, input.name);
  addIfNew(usedLinks, 'HiFi Shark', hifiShark);

  // Priority 2: eBay filtered search
  addIfNew(usedLinks, 'eBay', ebayUrl(input.brand, input.name));

  // Priority 3: Additional used-market sources
  if (input.usedMarketSources) {
    for (const src of input.usedMarketSources) {
      addIfNew(usedLinks, src.name, src.url);
    }
  }

  // ── Build "Further reading" links ──
  const readingLinks: ResolvedLink[] = [];
  for (const l of allRetailer) {
    if (isReadingLink(l.label)) {
      addIfNew(readingLinks, l.label, l.url);
    }
  }
  for (const l of allAdvisory) {
    if (l.kind === 'review' || l.kind === 'reference' || isReadingLink(l.label)) {
      addIfNew(readingLinks, l.label, l.url);
    }
  }

  // ── Guarantee: at least one link always appears ──
  // If both "Buy new" and "Product page" are empty and product is current,
  // ensure at least a manufacturer link exists so the card isn't link-less.
  if (!isUsedOnly && newLinks.length === 0 && manufacturerLinks.length === 0) {
    const fallbackUrl = input.manufacturerUrl ?? allRetailer[0]?.url;
    if (fallbackUrl) {
      addIfNew(manufacturerLinks, input.brand ?? 'Manufacturer', fallbackUrl);
    }
  }
  // "Buy used" always has at least HiFi Shark + eBay (generated), so this is a safety net
  if (usedLinks.length === 0) {
    addIfNew(usedLinks, 'HiFi Shark', hifiSharkUrl(input.brand, input.name));
  }

  return {
    newLinks,
    manufacturerLinks,
    usedLinks,
    readingLinks,
    isUsedOnly,
    hasVerifiedAmazon,
  };
}
