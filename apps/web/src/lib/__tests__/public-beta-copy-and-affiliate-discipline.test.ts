/**
 * Early-public-beta copy + affiliate-discipline regression suite
 * (2026-05-19; copy-simplification refresh 2026-05-20).
 *
 * Locks two invariants for the public-beta phase:
 *
 *   1. Onboarding copy — the homepage hero h1 and the affiliate-
 *      disclosure page copy must not slip into review-aggregator
 *      framing, "best deal" / "recommended seller" / "buy now"
 *      claims, or other commercial-first language that would
 *      conflict with the F3/F4 positioning.
 *
 *   2. Affiliate-link non-influence — `shouldShowAmazonLink` /
 *      `getAmazonSearchUrl` must remain free of any scoring or
 *      ranking inputs, and the product-scoring module must remain
 *      free of any Amazon/affiliate/commission/ASIN reference.
 *
 * Both invariants are asserted by reading the source files via
 * fs.readFileSync (the existing pattern used elsewhere in the
 * codebase for static-text guards). React component rendering is
 * not exercised — only the source text and module interfaces.
 */

import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { shouldShowAmazonLink, getAmazonSearchUrl, getAffiliateTag } from '../amazon-links';
import { buildProductLinks } from '../product-links';
import { getAmazonAffiliateTag, getEbayCampaignId, getEbayCustomId, getEbayHost } from '../affiliate-config';
import { getEbaySearchUrl } from '../ebay-links';

// ── Helpers ──────────────────────────────────────────────────

function readRepoFile(relPath: string): string {
  // __dirname is apps/web/src/lib/__tests__ when vitest runs from repo root.
  // Resolve relative to the repo root via process.cwd().
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
}

/**
 * Collapse all whitespace runs to single spaces. JSX wraps copy
 * across lines for readability, so phrases like "never on\n        commission
 * potential" need to match against "never on commission potential"
 * for assertion purposes.
 */
function normalize(src: string): string {
  return src.replace(/\s+/g, ' ');
}

// Risky review-aggregator framing patterns that must not appear in
// user-visible onboarding copy under the F3 positioning rule.
const REVIEWER_FRAMING_PATTERNS: RegExp[] = [
  /reviewer\s+consensus/i,
  /trained\s+on\s+reviews/i,
  /review\s+harvest/i,
  /summarizes\s+reviews/i,
  /\bAI\s+reviewer\b/i,
  /review\s+summarizer/i,
  /aggregat\w*\s+reviews?/i,
  /(?:powered|built|trained)\s+by\s+(?:expert\s+)?reviewers?/i,
];

// Commercial-first / "buy now" framing that must not appear in
// user-visible onboarding or disclosure copy.
const COMMERCIAL_FIRST_PATTERNS: RegExp[] = [
  /\bbuy\s+now\b/i,
  /\bclick\s+here\b/i,
  /\blimited\s+time\b/i,
  /\bspecial\s+offer\b/i,
  /\border\s+now\b/i,
  /\badd\s+to\s+cart\b/i,
];

// ── 1. Homepage h1 copy invariants ────────────────────────────
//
// 2026-05-20 copy simplification: the hero now consists of a single
// h1 (the value-prop tagline). The prior HOMEPAGE_HEADLINE const,
// HOMEPAGE_INTRO const + paragraph, and the small uppercase eyebrow
// div above the wordmark were all removed. The wordmark "Audio XX"
// was demoted from h1 to a div with the same styling and reset
// behaviour so the page retains exactly one h1.

const HOMEPAGE_H1_TEXT = 'Hifi gear recommendations matched to your taste and system';

describe('Homepage hero h1 (single source of the page heading)', () => {
  const pageSource = readRepoFile('apps/web/src/app/page.tsx');

  it('renders the value-prop tagline as the homepage h1', () => {
    expect(pageSource).toContain(HOMEPAGE_H1_TEXT);
    // The tagline appears inside an <h1> element (not just a comment).
    const h1Block = pageSource.match(/<h1[^>]*>[\s\S]*?<\/h1>/);
    expect(h1Block, 'an <h1>...</h1> block must be present in page.tsx').not.toBeNull();
    expect(h1Block![0]).toContain(HOMEPAGE_H1_TEXT);
  });

  it('contains exactly one <h1> element so SEO / accessibility outline is preserved', () => {
    const openCount = (pageSource.match(/<h1[\s>]/g) ?? []).length;
    const closeCount = (pageSource.match(/<\/h1>/g) ?? []).length;
    expect(openCount).toBe(1);
    expect(closeCount).toBe(1);
  });

  it('h1 text stays short — under 100 characters', () => {
    expect(HOMEPAGE_H1_TEXT.length).toBeLessThan(100);
  });

  it('h1 text does not slip into review-aggregator framing', () => {
    for (const pattern of REVIEWER_FRAMING_PATTERNS) {
      expect(HOMEPAGE_H1_TEXT, `pattern matched: ${pattern}`).not.toMatch(pattern);
    }
  });

  it('h1 text does not contain commercial-first / "buy now" framing', () => {
    for (const pattern of COMMERCIAL_FIRST_PATTERNS) {
      expect(HOMEPAGE_H1_TEXT, `pattern matched: ${pattern}`).not.toMatch(pattern);
    }
  });
});

// ── 1b. Removed hero strings must stay absent ─────────────────
//
// The 2026-05-20 simplification removed three pieces of hero copy.
// These assertions guard against re-introduction (paste-back from
// older snapshots, partial reverts, etc.).

const REMOVED_HERO_STRINGS = [
  'Reads what you value',
  'Interprets your system',
  'Names the trade-offs of change',
  'Hifi matched to your preferences, system, and long-term happiness',
  'Audio XX helps you understand your listening preferences',
] as const;

describe('Removed hero copy must stay absent (2026-05-20 simplification)', () => {
  const pageSource = readRepoFile('apps/web/src/app/page.tsx');

  for (const removed of REMOVED_HERO_STRINGS) {
    it(`page.tsx no longer contains "${removed}"`, () => {
      expect(pageSource).not.toContain(removed);
    });
  }

  it('no HOMEPAGE_INTRO or HOMEPAGE_HEADLINE const remains', () => {
    expect(pageSource).not.toMatch(/const\s+HOMEPAGE_INTRO\b/);
    expect(pageSource).not.toMatch(/const\s+HOMEPAGE_HEADLINE\b/);
  });
});

// ── 2. Affiliate-disclosure page copy invariants ─────────────

describe('Affiliate Disclosure page copy', () => {
  // Normalize whitespace so JSX line-wrapped phrases match.
  const disclosureSource = normalize(readRepoFile('apps/web/src/app/affiliate-disclosure/page.tsx').toLowerCase());

  it('contains the explicit "does not affect our recommendations" line', () => {
    expect(disclosureSource).toContain('does not affect our recommendations');
  });

  it('contains the "never on commission potential" disclaimer', () => {
    expect(disclosureSource).toContain('never on commission potential');
  });

  it('explicitly disclaims "best deal" claims (2026-05-19 reinforcement)', () => {
    expect(disclosureSource).toContain('best deal');
    // Phrased as a disclaimer, not an assertion.
    expect(disclosureSource).toMatch(/does not make .{0,40}best deal|no .{0,15}best deal/);
  });

  it('explicitly disclaims "recommended seller" claims (2026-05-19 reinforcement)', () => {
    expect(disclosureSource).toContain('recommended seller');
  });

  it('explicitly states affiliate links are not used as evidence for recommendations', () => {
    expect(disclosureSource).toMatch(/never used as evidence for a recommendation/);
  });

  it('explicitly states affiliate links do not influence scoring or ranking', () => {
    expect(disclosureSource).toMatch(/never weighted into product scoring|never used to decide which products are surfaced/);
  });

  it('does not contain review-aggregator framing', () => {
    for (const pattern of REVIEWER_FRAMING_PATTERNS) {
      expect(disclosureSource, `pattern matched: ${pattern}`).not.toMatch(pattern);
    }
  });

  // ── Pricing / availability disclosure (2026-05-19 addition) ──
  //
  // Catalog prices render as fixed values on product cards. The
  // disclosure page must clarify these are NOT live and should not
  // be read as current market data — and must explicitly disclaim
  // live pricing / inventory / real-time stock claims.

  it('contains a "Pricing and availability" section', () => {
    expect(disclosureSource).toContain('pricing and availability');
  });

  it('clarifies catalog prices are approximate (not a live quote)', () => {
    expect(disclosureSource).toMatch(/approximate|may not reflect current/);
  });

  it('explicitly disclaims live pricing / inventory / real-time stock claims', () => {
    expect(disclosureSource).toMatch(/does not synchronize live pricing|does not.{0,30}real-time stock|not.{0,30}live pricing/);
  });

  it('does not claim live / current / today\'s pricing or inventory anywhere', () => {
    expect(disclosureSource).not.toMatch(/\blive\s+price[s]?\b(?!\s*or\s+inventory|\s*and\s+inventory)/);
    expect(disclosureSource).not.toMatch(/\btoday'?s\s+price[s]?\b/);
    expect(disclosureSource).not.toMatch(/\bcheapest\s+price\b/);
    expect(disclosureSource).not.toMatch(/\blowest\s+price\b/);
    expect(disclosureSource).not.toMatch(/\bin\s+stock\s+now\b/);
  });
});

// ── 3. Affiliate-link non-influence invariants ───────────────

describe('Amazon affiliate link non-influence', () => {
  it('shouldShowAmazonLink decision is based only on product attributes (no scoring inputs)', () => {
    // Pure-function check — exercise the function with attribute-only
    // inputs and verify the outcome matches the documented policy.
    expect(shouldShowAmazonLink({ availability: 'discontinued' })).toBe(false);
    expect(shouldShowAmazonLink({ availability: 'vintage' })).toBe(false);
    expect(shouldShowAmazonLink({ typicalMarket: 'used' })).toBe(false);
    expect(shouldShowAmazonLink({ buyingContext: 'used_only' })).toBe(false);
    expect(shouldShowAmazonLink({ brand: 'Decware' })).toBe(false);
    expect(shouldShowAmazonLink({ brand: 'Leben' })).toBe(false);
    // current + no exclusion → true (availability-based, not score-based)
    expect(shouldShowAmazonLink({ brand: 'Schiit', availability: 'current' })).toBe(true);
  });

  it('getAmazonSearchUrl always returns a valid Amazon search URL (with or without tag)', () => {
    const url = getAmazonSearchUrl('Bifrost 2/64', 'Schiit');
    expect(url).toContain('amazon.com/s');
    expect(url).toContain('Bifrost');
    // No score/ranking/preference signals leak into the URL
    expect(url).not.toMatch(/score|rank|preferred|priority|weight/i);
  });

  it('product-scoring.ts contains no Amazon / affiliate / commission / ASIN reference', () => {
    const scoringSource = readRepoFile('apps/web/src/lib/product-scoring.ts');
    // Case-insensitive, but allow comments — the test fails on actual code references too
    // (any of these tokens in a real source file would indicate ranking influence).
    expect(scoringSource).not.toMatch(/\bamazon\b/i);
    expect(scoringSource).not.toMatch(/\baffiliate\b/i);
    expect(scoringSource).not.toMatch(/\bcommission\b/i);
    expect(scoringSource).not.toMatch(/\bASIN\b/);
  });

  it('amazon-links.ts does not import or reference product-scoring (no inverse coupling)', () => {
    const amazonSource = readRepoFile('apps/web/src/lib/amazon-links.ts');
    // Narrow: actual ES-module import statement (not English "importing" in a doc comment).
    expect(amazonSource).not.toMatch(/import[^;]*from\s+['"][./]*product-scoring['"]/);
    expect(amazonSource).not.toMatch(/require\s*\(\s*['"][./]*product-scoring['"]\s*\)/);
    expect(amazonSource).not.toMatch(/\bscoreProduct\b|\brankProducts\b|\breRankForRefinement\b/);
  });

  it('affiliate-config.ts does not import or reference product-scoring / recommendation modules', () => {
    const configSource = readRepoFile('apps/web/src/lib/affiliate-config.ts');
    expect(configSource).not.toMatch(/import[^;]*from\s+['"][./]*product-scoring['"]/);
    expect(configSource).not.toMatch(/import[^;]*from\s+['"][./]*product-assessment['"]/);
    expect(configSource).not.toMatch(/import[^;]*from\s+['"][./]*advisory-response['"]/);
    expect(configSource).not.toMatch(/\bscoreProduct\b|\brankProducts\b|\breRankForRefinement\b|\bbuildProductAssessment\b/);
  });
});

// ── 4b. Env-driven affiliate config behavior ─────────────────
//
// Per the 2026-05-19 affiliate-config centralization:
//   - getAmazonAffiliateTag() reads AMAZON_AFFILIATE_TAG env var
//   - getEbayCampaignId() reads EBAY_CAMPAIGN_ID env var
//   - Both return undefined when env unset / empty / whitespace
//   - getAmazonSearchUrl conditionally includes the `tag=` param
//     based on the env value (no tag when unset)

describe('Affiliate env-driven config', () => {
  // Snapshot + restore env vars for each test to avoid cross-test
  // pollution. Tests in this describe directly mutate process.env.
  const ORIG_AMAZON = process.env.AMAZON_AFFILIATE_TAG;
  const ORIG_EBAY = process.env.EBAY_CAMPAIGN_ID;
  const ORIG_EBAY_CUSTOM = process.env.EBAY_CUSTOM_ID;
  const ORIG_EBAY_HOST = process.env.EBAY_HOST;
  beforeEach(() => {
    delete process.env.AMAZON_AFFILIATE_TAG;
    delete process.env.EBAY_CAMPAIGN_ID;
    delete process.env.EBAY_CUSTOM_ID;
    delete process.env.EBAY_HOST;
  });
  afterEach(() => {
    if (ORIG_AMAZON === undefined) delete process.env.AMAZON_AFFILIATE_TAG;
    else process.env.AMAZON_AFFILIATE_TAG = ORIG_AMAZON;
    if (ORIG_EBAY === undefined) delete process.env.EBAY_CAMPAIGN_ID;
    else process.env.EBAY_CAMPAIGN_ID = ORIG_EBAY;
    if (ORIG_EBAY_CUSTOM === undefined) delete process.env.EBAY_CUSTOM_ID;
    else process.env.EBAY_CUSTOM_ID = ORIG_EBAY_CUSTOM;
    if (ORIG_EBAY_HOST === undefined) delete process.env.EBAY_HOST;
    else process.env.EBAY_HOST = ORIG_EBAY_HOST;
  });

  it('getAmazonAffiliateTag returns undefined when env var is unset', () => {
    expect(getAmazonAffiliateTag()).toBeUndefined();
  });

  it('getAmazonAffiliateTag returns undefined when env var is empty string', () => {
    process.env.AMAZON_AFFILIATE_TAG = '';
    expect(getAmazonAffiliateTag()).toBeUndefined();
  });

  it('getAmazonAffiliateTag returns undefined when env var is whitespace only', () => {
    process.env.AMAZON_AFFILIATE_TAG = '   ';
    expect(getAmazonAffiliateTag()).toBeUndefined();
  });

  it('getAmazonAffiliateTag returns the trimmed value when env var is set', () => {
    process.env.AMAZON_AFFILIATE_TAG = '  audioxx20-20  ';
    expect(getAmazonAffiliateTag()).toBe('audioxx20-20');
  });

  it('getEbayCampaignId returns undefined when env var is unset', () => {
    expect(getEbayCampaignId()).toBeUndefined();
  });

  it('getEbayCampaignId returns the trimmed value when env var is set', () => {
    process.env.EBAY_CAMPAIGN_ID = '  5338000000  ';
    expect(getEbayCampaignId()).toBe('5338000000');
  });

  it('getAmazonSearchUrl OMITS the `tag` parameter when AMAZON_AFFILIATE_TAG is unset', () => {
    const url = getAmazonSearchUrl('Bifrost 2/64', 'Schiit');
    expect(url).not.toContain('tag=');
    expect(url).toContain('amazon.com/s');
    expect(url).toContain('Bifrost');
  });

  it('getAmazonSearchUrl OMITS the `tag` parameter when AMAZON_AFFILIATE_TAG is empty', () => {
    process.env.AMAZON_AFFILIATE_TAG = '';
    const url = getAmazonSearchUrl('Bifrost 2/64', 'Schiit');
    expect(url).not.toContain('tag=');
  });

  it('getAmazonSearchUrl INCLUDES the `tag` parameter when AMAZON_AFFILIATE_TAG is set', () => {
    process.env.AMAZON_AFFILIATE_TAG = 'audioxx20-20';
    const url = getAmazonSearchUrl('Bifrost 2/64', 'Schiit');
    expect(url).toContain('tag=audioxx20-20');
  });

  it('getAffiliateTag back-compat helper returns empty string when env unset', () => {
    expect(getAffiliateTag()).toBe('');
  });

  it('getAffiliateTag back-compat helper returns the env value when set', () => {
    process.env.AMAZON_AFFILIATE_TAG = 'audioxx20-20';
    expect(getAffiliateTag()).toBe('audioxx20-20');
  });

  it('changing env var does NOT affect shouldShowAmazonLink decision', () => {
    // Critical invariant: affiliate config is link-rendering only.
    // shouldShowAmazonLink must depend only on product attributes,
    // never on whether an affiliate tag is configured.
    const noTag = shouldShowAmazonLink({ brand: 'Schiit', availability: 'current' });
    process.env.AMAZON_AFFILIATE_TAG = 'audioxx20-20';
    const withTag = shouldShowAmazonLink({ brand: 'Schiit', availability: 'current' });
    expect(noTag).toBe(withTag);
    expect(noTag).toBe(true);
  });

  // ── eBay env-driven config (2026-05-19 follow-on) ──────────
  // Audio XX is U.S.-centered by default with single-host
  // override via EBAY_HOST. No region selector, no geo-routing,
  // no marketplace inference. EPN tagging via EBAY_CAMPAIGN_ID
  // + optional EBAY_CUSTOM_ID, both gated on presence.

  it('getEbayHost defaults to www.ebay.com when EBAY_HOST is unset', () => {
    expect(getEbayHost()).toBe('www.ebay.com');
  });

  it('getEbayHost defaults to www.ebay.com when EBAY_HOST is empty', () => {
    process.env.EBAY_HOST = '';
    expect(getEbayHost()).toBe('www.ebay.com');
  });

  it('getEbayHost defaults to www.ebay.com when EBAY_HOST is whitespace only', () => {
    process.env.EBAY_HOST = '   ';
    expect(getEbayHost()).toBe('www.ebay.com');
  });

  it('getEbayHost returns the trimmed override when EBAY_HOST is set', () => {
    process.env.EBAY_HOST = '  www.ebay.co.uk  ';
    expect(getEbayHost()).toBe('www.ebay.co.uk');
  });

  it('getEbayCustomId returns undefined when env var is unset', () => {
    expect(getEbayCustomId()).toBeUndefined();
  });

  it('getEbayCustomId returns the trimmed value when env var is set', () => {
    process.env.EBAY_CUSTOM_ID = '  Audioxx  ';
    expect(getEbayCustomId()).toBe('Audioxx');
  });

  it('getEbaySearchUrl uses default www.ebay.com host when EBAY_HOST unset', () => {
    const url = getEbaySearchUrl('Naim Nait XS 3');
    expect(url.startsWith('https://www.ebay.com/sch/i.html?')).toBe(true);
    expect(url).toContain('_nkw=Naim+Nait+XS+3');
  });

  it('getEbaySearchUrl uses EBAY_HOST override when set', () => {
    process.env.EBAY_HOST = 'www.ebay.fr';
    const url = getEbaySearchUrl('Naim Nait XS 3');
    expect(url.startsWith('https://www.ebay.fr/sch/i.html?')).toBe(true);
  });

  it('getEbaySearchUrl supports www.ebay.co.uk override', () => {
    process.env.EBAY_HOST = 'www.ebay.co.uk';
    const url = getEbaySearchUrl('Naim Nait XS 3');
    expect(url.startsWith('https://www.ebay.co.uk/sch/i.html?')).toBe(true);
  });

  it('getEbaySearchUrl OMITS campid when EBAY_CAMPAIGN_ID is unset (plain fallback)', () => {
    const url = getEbaySearchUrl('Naim Nait XS 3');
    expect(url).not.toContain('campid=');
    expect(url).not.toContain('customid=');
  });

  it('getEbaySearchUrl OMITS campid when EBAY_CAMPAIGN_ID is empty', () => {
    process.env.EBAY_CAMPAIGN_ID = '';
    const url = getEbaySearchUrl('Naim Nait XS 3');
    expect(url).not.toContain('campid=');
  });

  it('getEbaySearchUrl INCLUDES campid when EBAY_CAMPAIGN_ID is set', () => {
    process.env.EBAY_CAMPAIGN_ID = '5339152664';
    const url = getEbaySearchUrl('Naim Nait XS 3');
    expect(url).toContain('campid=5339152664');
  });

  it('getEbaySearchUrl OMITS customid when EBAY_CUSTOM_ID is unset (but campid present)', () => {
    process.env.EBAY_CAMPAIGN_ID = '5339152664';
    const url = getEbaySearchUrl('Naim Nait XS 3');
    expect(url).toContain('campid=5339152664');
    expect(url).not.toContain('customid=');
  });

  it('getEbaySearchUrl INCLUDES customid only when BOTH campaign + custom IDs are set', () => {
    process.env.EBAY_CAMPAIGN_ID = '5339152664';
    process.env.EBAY_CUSTOM_ID = 'Audioxx';
    const url = getEbaySearchUrl('Naim Nait XS 3');
    expect(url).toContain('campid=5339152664');
    expect(url).toContain('customid=Audioxx');
  });

  it('getEbaySearchUrl OMITS customid when EBAY_CAMPAIGN_ID is unset even if EBAY_CUSTOM_ID is set', () => {
    // Custom IDs are meaningless without an EPN campaign to attribute
    // to — they must be gated on the campaign ID being present.
    process.env.EBAY_CUSTOM_ID = 'Audioxx';
    const url = getEbaySearchUrl('Naim Nait XS 3');
    expect(url).not.toContain('campid=');
    expect(url).not.toContain('customid=');
  });

  it('getEbaySearchUrl plain fallback works with NO env vars at all', () => {
    const url = getEbaySearchUrl('Naim Nait XS 3');
    expect(url).toBe('https://www.ebay.com/sch/i.html?_nkw=Naim+Nait+XS+3');
  });

  it('getEbaySearchUrl preserves caller extraParams alongside EPN tagging', () => {
    process.env.EBAY_CAMPAIGN_ID = '5339152664';
    const url = getEbaySearchUrl('Naim Nait XS 3', {
      extraParams: { _sacat: '293', LH_All: '1' },
    });
    expect(url).toContain('_nkw=Naim+Nait+XS+3');
    expect(url).toContain('_sacat=293');
    expect(url).toContain('LH_All=1');
    expect(url).toContain('campid=5339152664');
  });

  it('eBay env config does NOT affect shouldShowAmazonLink (no cross-channel coupling)', () => {
    // Independence invariant: changing eBay env vars must never
    // perturb Amazon eligibility (or vice versa). Both channels
    // are rendering-only — neither feeds back into recommendation.
    const baseline = shouldShowAmazonLink({ brand: 'Schiit', availability: 'current' });
    process.env.EBAY_CAMPAIGN_ID = '5339152664';
    process.env.EBAY_CUSTOM_ID = 'Audioxx';
    process.env.EBAY_HOST = 'www.ebay.fr';
    const withEbay = shouldShowAmazonLink({ brand: 'Schiit', availability: 'current' });
    expect(withEbay).toBe(baseline);
  });
});

// ── 4c. eBay link source-text discipline ─────────────────────
//
// ebay-links.ts must NOT import any scoring / recommendation /
// ranking module (matches the amazon-links.ts and
// affiliate-config.ts coupling rules). The four migrated call
// sites must NOT hardcode an ebay.com host (all eBay URLs flow
// through getEbaySearchUrl so EBAY_HOST overrides are honored).

describe('eBay link source-text discipline', () => {
  it('ebay-links.ts does not import product-scoring or recommendation modules', () => {
    const src = readRepoFile('apps/web/src/lib/ebay-links.ts');
    expect(src).not.toMatch(/import[^;]*from\s+['"][./]*product-scoring['"]/);
    expect(src).not.toMatch(/import[^;]*from\s+['"][./]*product-assessment['"]/);
    expect(src).not.toMatch(/import[^;]*from\s+['"][./]*advisory-response['"]/);
    expect(src).not.toMatch(/\bscoreProduct\b|\brankProducts\b|\breRankForRefinement\b|\bbuildProductAssessment\b/);
  });

  it('migrated callers do not hardcode a www.ebay.com host (use getEbaySearchUrl)', () => {
    // Each caller previously composed eBay URLs inline with a
    // hardcoded ebay.com host. Post-migration all four route
    // through getEbaySearchUrl, which honours EBAY_HOST. This
    // test fails if a future change reintroduces an inline URL.
    const filesToScan = [
      'apps/web/src/lib/shopping-intent.ts',
      'apps/web/src/lib/unknown-product-clarification.ts',
      'apps/web/src/lib/product-links.ts',
      'apps/web/src/lib/consultation.ts',
    ];
    for (const f of filesToScan) {
      const src = readRepoFile(f);
      // Look for the inline pattern: a template literal or string
      // that hardcodes an ebay.com URL path. The baseUrl display
      // string in shopping-intent.ts (USED_MARKET_SITES baseUrl)
      // is allowed — it's not a clickable link, it's a label.
      expect(src, `${f} must not hardcode ebay.com/sch/i.html`).not.toMatch(/ebay\.com\/sch\/i\.html/);
    }
  });
});

// ── 4. Product-link surface — graceful missing-link handling ──
//
// Product cards must degrade cleanly when any subset of the link
// arrays (retailer, advisory, manufacturerUrl, usedMarketUrl) is
// missing. buildProductLinks() is the single canonical resolver,
// so asserting its behavior with empty/sparse inputs covers the
// graceful-degradation property for every card site that uses it.

describe('Product-link surface — graceful missing-link handling', () => {
  it('returns well-formed link arrays (not undefined / not crash) when ALL inputs are absent', () => {
    const r = buildProductLinks({ name: 'Test', brand: 'TestBrand' });
    // Each group is an array — never undefined, never throwing.
    expect(Array.isArray(r.newLinks)).toBe(true);
    expect(Array.isArray(r.manufacturerLinks)).toBe(true);
    expect(Array.isArray(r.usedLinks)).toBe(true);
    expect(Array.isArray(r.readingLinks)).toBe(true);
    // Deterministic used-market search fallback (HiFi Shark / eBay) IS
    // intentional — when the catalog has no curated dealer / manufacturer
    // / Amazon links, give the user somewhere to look. Not an empty card.
  });

  it('curated retailer-link absence does not produce buy-new or manufacturer links', () => {
    const r = buildProductLinks({ name: 'Test', brand: 'TestBrand', retailerLinks: [] });
    expect(r.newLinks).toEqual([]);
    expect(r.manufacturerLinks).toEqual([]);
  });

  it('still surfaces manufacturerUrl when the retailer link list is empty', () => {
    const r = buildProductLinks({ name: 'Test', brand: 'TestBrand', manufacturerUrl: 'https://example-brand.com/product' });
    // manufacturerUrl fallback should produce at least one manufacturer or new link
    const anyLinkPresent = r.newLinks.length > 0 || r.manufacturerLinks.length > 0;
    expect(anyLinkPresent).toBe(true);
  });

  it('does not throw when both retailerLinks and advisoryLinks are undefined', () => {
    expect(() => buildProductLinks({ name: 'Test', brand: 'TestBrand', availability: 'current' })).not.toThrow();
    expect(() => buildProductLinks({ name: 'Test', brand: 'TestBrand', availability: 'discontinued' })).not.toThrow();
  });
});

// ── 5. Inactive product safeguards (discontinued/vintage suppression) ──
//
// 'availability' === 'current' is the proxy for active/inactive
// status. Discontinued and vintage products must:
//   - have Amazon links suppressed (shouldShowAmazonLink → false)
//   - be flagged via the isUsedOnly flag in the link resolver
// These are existing invariants — this test locks them.

describe('Inactive (discontinued/vintage) product safeguards', () => {
  it('shouldShowAmazonLink returns false for discontinued products', () => {
    expect(shouldShowAmazonLink({ availability: 'discontinued' })).toBe(false);
  });

  it('shouldShowAmazonLink returns false for vintage products', () => {
    expect(shouldShowAmazonLink({ availability: 'vintage' })).toBe(false);
  });

  it('buildProductLinks marks discontinued products as used-only', () => {
    const r = buildProductLinks({ name: 'Test', brand: 'TestBrand', availability: 'discontinued' });
    expect(r.isUsedOnly).toBe(true);
  });

  it('buildProductLinks marks vintage products as used-only', () => {
    const r = buildProductLinks({ name: 'Test', brand: 'TestBrand', availability: 'vintage' });
    expect(r.isUsedOnly).toBe(true);
  });

  it('buildProductLinks marks typicalMarket=used products as used-only', () => {
    const r = buildProductLinks({ name: 'Test', brand: 'TestBrand', typicalMarket: 'used' });
    expect(r.isUsedOnly).toBe(true);
  });
});

// ── 6. Onboarding scope (no wizard / no quiz / no profile setup) ──

describe('Onboarding scope discipline', () => {
  const pageSource = readRepoFile('apps/web/src/app/page.tsx');

  it('homepage does not introduce a wizard, quiz, or step-flow component', () => {
    // Heuristic: the words "wizard" / "preference quiz" / "setup flow"
    // should not appear as UI labels. A "step N of M" pattern is also a
    // wizard tell, but only when it appears as a JSX text node (i.e.
    // wrapped in `>...<`). Internal staging references in code comments
    // (e.g. "Step 3 of 9 — beta path" describing the beta-intent
    // intercept ordering) are legitimate and excluded.
    expect(pageSource).not.toMatch(/onboarding\s*wizard/i);
    expect(pageSource).not.toMatch(/preference\s*quiz/i);
    expect(pageSource).not.toMatch(/setup\s*flow/i);
    expect(pageSource).not.toMatch(/>\s*step\s+\d+\s+of\s+\d+\s*</i);
  });

  it('homepage does not introduce a forced-profile-setup modal', () => {
    // No "Complete your profile to continue" or similar forcing language
    expect(pageSource).not.toMatch(/complete your profile to continue/i);
    expect(pageSource).not.toMatch(/finish setup to continue/i);
    expect(pageSource).not.toMatch(/required.{0,30}before you can/i);
  });

  it('review-boundary language is preserved on /how-it-works', () => {
    // F3 positioning: review boundary lives on the How It Works page,
    // not on the homepage hero. Confirm the page still distances itself
    // from professional-reviewer work (the canonical line is "not a
    // substitute for that work").
    const howItWorks = readRepoFile('apps/web/src/app/how-it-works/page.tsx');
    expect(howItWorks).toMatch(/not\s+a\s+substitute\s+for\s+that\s+work/i);
  });

  it('review-boundary language is preserved on /affiliate-disclosure', () => {
    // F4 reviewer-data exclusion: the disclosure page must still state
    // that affiliate links are not used as evidence for recommendations.
    const disclosure = normalize(
      readRepoFile('apps/web/src/app/affiliate-disclosure/page.tsx').toLowerCase(),
    );
    expect(disclosure).toMatch(/never used as evidence for a recommendation/);
    expect(disclosure).toContain('does not affect our recommendations');
  });
});
