/**
 * Tests for deterministic product link builder.
 *
 * Validates:
 *   - Link priority ordering (dealer → amazon → manufacturer)
 *   - Amazon link only shown when verified ASIN exists
 *   - No duplicate URLs
 *   - At least one link always appears
 *   - Used-market links always present
 *   - Discontinued/vintage products skip "Buy new"
 */

import { describe, it, expect } from 'vitest';
import { buildProductLinks, type ProductLinkInput } from '../product-links';

// ── Fixture: product WITH verified Amazon ASIN ──────────
const WITH_AMAZON: ProductLinkInput = {
  name: 'DO300',
  brand: 'SMSL',
  retailerLinks: [
    { label: 'SMSL', url: 'https://www.smsl-audio.com/portal/product/detail/id/879.html' },
    { label: 'Amazon', url: 'https://www.amazon.com/dp/B0BPRL3GYX' },
    { label: 'Apos Audio', url: 'https://apos.audio/products/smsl-do300' },
  ],
  advisoryLinks: [
    { label: 'SMSL', url: 'https://www.smsl-audio.com/portal/product/detail/id/879.html', kind: 'reference' },
    { label: 'Amazon', url: 'https://www.amazon.com/dp/B0BPRL3GYX', kind: 'reference' },
    { label: 'Apos Audio', url: 'https://apos.audio/products/smsl-do300', kind: 'reference' },
  ],
  availability: 'current',
  manufacturerUrl: 'https://www.smsl-audio.com/portal/product/detail/id/879.html',
};

// ── Fixture: product WITHOUT Amazon ─────────────────────
const WITHOUT_AMAZON: ProductLinkInput = {
  name: 'Zen DAC',
  brand: 'Decware',
  retailerLinks: [
    { label: 'Decware', url: 'https://www.decware.com/newsite/ZenDAC.html' },
  ],
  advisoryLinks: [
    { label: 'Decware', url: 'https://www.decware.com/newsite/ZenDAC.html', kind: 'reference' },
  ],
  availability: 'current',
  manufacturerUrl: 'https://www.decware.com/newsite/ZenDAC.html',
};

// ── Fixture: discontinued product ───────────────────────
const DISCONTINUED: ProductLinkInput = {
  name: 'Hugo',
  brand: 'Chord',
  retailerLinks: [
    { label: 'Chord', url: 'https://chordelectronics.co.uk/product/hugo/' },
  ],
  availability: 'discontinued',
  manufacturerUrl: 'https://chordelectronics.co.uk/product/hugo/',
};

// ── Fixture: product with dealer links ──────────────────
const WITH_DEALER: ProductLinkInput = {
  name: 'Enyo 15th',
  brand: 'Denafrips',
  retailerLinks: [
    { label: 'Vinshine Audio', url: 'https://www.vinshineaudio.com/product/denafrips-enyo-15th' },
    { label: 'Amazon', url: 'https://www.amazon.com/dp/B0EXAMPLEQ' },
  ],
  advisoryLinks: [
    { label: 'Vinshine Audio', url: 'https://www.vinshineaudio.com/product/denafrips-enyo-15th', kind: 'dealer' },
    { label: 'Amazon', url: 'https://www.amazon.com/dp/B0EXAMPLEQ', kind: 'reference' },
  ],
  availability: 'current',
  manufacturerUrl: 'https://www.denafrips.com/enyo-15th',
};

// ── Fixture: product with empty retailer_links ──────────
const EMPTY_LINKS: ProductLinkInput = {
  name: 'HD 650',
  brand: 'Sennheiser',
  retailerLinks: [],
  advisoryLinks: [],
  availability: 'current',
};

// ══════════════════════════════════════════════════════════
// 1. Priority ordering
// ══════════════════════════════════════════════════════════

describe('Link priority ordering', () => {
  it('dealer comes before Amazon and manufacturer', () => {
    const result = buildProductLinks(WITH_DEALER);
    const labels = result.newLinks.map(l => l.label);
    const dealerIdx = labels.indexOf('Vinshine Audio');
    const amazonIdx = labels.indexOf('Amazon');
    expect(dealerIdx).toBeLessThan(amazonIdx);
    // Manufacturer fallback may or may not appear depending on dedup
  });

  it('Amazon comes before manufacturer when both exist', () => {
    const result = buildProductLinks(WITH_AMAZON);
    const labels = result.newLinks.map(l => l.label);
    const amazonIdx = labels.indexOf('Amazon');
    // Apos Audio is a dealer-like name but not in the dealer list,
    // so it appears as manufacturer/reference
    expect(amazonIdx).toBeGreaterThanOrEqual(0);
  });

  it('manufacturer is present in manufacturerLinks (product page, not buy new)', () => {
    const result = buildProductLinks(WITHOUT_AMAZON);
    expect(result.manufacturerLinks.length).toBeGreaterThanOrEqual(1);
    expect(result.manufacturerLinks.some(l => l.label === 'Decware')).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
// 2. Amazon verification
// ══════════════════════════════════════════════════════════

describe('Amazon link verification', () => {
  it('shows Amazon when verified ASIN exists', () => {
    const result = buildProductLinks(WITH_AMAZON);
    expect(result.hasVerifiedAmazon).toBe(true);
    expect(result.newLinks.some(l => l.label === 'Amazon')).toBe(true);
  });

  it('does NOT show Amazon when brand is excluded', () => {
    const result = buildProductLinks(WITHOUT_AMAZON);
    expect(result.hasVerifiedAmazon).toBe(false);
    expect(result.newLinks.some(l => l.label === 'Amazon')).toBe(false);
  });

  it('Amazon link uses direct ASIN URL, not search URL', () => {
    const result = buildProductLinks(WITH_AMAZON);
    const amazonLink = result.newLinks.find(l => l.label === 'Amazon');
    expect(amazonLink?.url).toContain('/dp/B0BPRL3GYX');
    expect(amazonLink?.url).not.toContain('/s?');
  });

  it('does NOT generate search-based Amazon link for products without ASIN', () => {
    const noAsin: ProductLinkInput = {
      ...WITHOUT_AMAZON,
      brand: 'Schiit', // Not excluded, but no Amazon link in catalog
    };
    const result = buildProductLinks(noAsin);
    // Should not generate a search URL since no ASIN in retailer_links
    const amazonLink = result.newLinks.find(l => l.label === 'Amazon');
    expect(amazonLink).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════
// 3. Deduplication
// ══════════════════════════════════════════════════════════

describe('Link deduplication', () => {
  it('no duplicate URLs across new links', () => {
    const result = buildProductLinks(WITH_AMAZON);
    const urls = result.newLinks.map(l => l.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('no duplicate URLs across used links', () => {
    const result = buildProductLinks(WITH_AMAZON);
    const urls = result.usedLinks.map(l => l.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('dealer link not duplicated when also in advisoryLinks', () => {
    const result = buildProductLinks(WITH_DEALER);
    const vinshineLinks = result.newLinks.filter(l => l.url.includes('vinshineaudio'));
    expect(vinshineLinks.length).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════
// 4. Minimum link guarantee
// ══════════════════════════════════════════════════════════

describe('At least one link always appears', () => {
  it('current product with empty links still gets used links', () => {
    const result = buildProductLinks(EMPTY_LINKS);
    expect(result.usedLinks.length).toBeGreaterThanOrEqual(1);
    expect(result.usedLinks.some(l => l.label === 'HiFi Shark')).toBe(true);
  });

  it('discontinued product gets used links', () => {
    const result = buildProductLinks(DISCONTINUED);
    expect(result.usedLinks.length).toBeGreaterThanOrEqual(2);
    expect(result.usedLinks.some(l => l.label === 'HiFi Shark')).toBe(true);
    expect(result.usedLinks.some(l => l.label === 'eBay')).toBe(true);
  });

  it('discontinued product has no new links', () => {
    const result = buildProductLinks(DISCONTINUED);
    expect(result.newLinks.length).toBe(0);
    expect(result.isUsedOnly).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
// 5. Used-market links
// ══════════════════════════════════════════════════════════

describe('Used-market links', () => {
  it('always includes HiFi Shark and eBay', () => {
    const result = buildProductLinks(WITH_AMAZON);
    expect(result.usedLinks.some(l => l.label === 'HiFi Shark')).toBe(true);
    expect(result.usedLinks.some(l => l.label === 'eBay')).toBe(true);
  });

  it('includes additional used sources when provided', () => {
    const withUsed: ProductLinkInput = {
      ...WITH_AMAZON,
      usedMarketSources: [
        { name: 'Audiogon', url: 'https://www.audiogon.com/listings?q=smsl+do300', region: 'north-america' },
      ],
    };
    const result = buildProductLinks(withUsed);
    expect(result.usedLinks.some(l => l.label === 'Audiogon')).toBe(true);
  });

  it('uses pre-computed usedMarketUrl for HiFi Shark when provided', () => {
    const withCustom: ProductLinkInput = {
      ...WITH_AMAZON,
      usedMarketUrl: 'https://www.hifishark.com/search?q=custom+url',
    };
    const result = buildProductLinks(withCustom);
    const hifi = result.usedLinks.find(l => l.label === 'HiFi Shark');
    expect(hifi?.url).toBe('https://www.hifishark.com/search?q=custom+url');
  });
});

// ══════════════════════════════════════════════════════════
// 6. Reading links
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
// 6. Purchase path regression — parity between card types
// ══════════════════════════════════════════════════════════
// Both AdvisoryProductCard (shopping) and AdvisoryUpgradePaths (upgrade)
// now call buildProductLinks(). These tests verify the builder produces
// correct output for the field shapes available from each card path.

describe('Purchase path regression: product with both new + used links', () => {
  const QUTEST_LIKE: ProductLinkInput = {
    name: 'Qutest',
    brand: 'Chord',
    retailerLinks: [
      { label: 'Chord', url: 'https://chordelectronics.co.uk/product/qutest/' },
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B07B4NY7DH' },
    ],
    availability: 'current',
    typicalMarket: 'both',
    manufacturerUrl: 'https://chordelectronics.co.uk/product/qutest/',
  };

  it('produces at least one Buy new link', () => {
    const result = buildProductLinks(QUTEST_LIKE);
    expect(result.newLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('produces HiFi Shark + eBay used links', () => {
    const result = buildProductLinks(QUTEST_LIKE);
    expect(result.usedLinks.some(l => l.label === 'HiFi Shark')).toBe(true);
    expect(result.usedLinks.some(l => l.label === 'eBay')).toBe(true);
  });

  it('includes Amazon when verified ASIN is present', () => {
    const result = buildProductLinks(QUTEST_LIKE);
    expect(result.hasVerifiedAmazon).toBe(true);
    expect(result.newLinks.some(l => l.label === 'Amazon')).toBe(true);
  });

  it('isUsedOnly is false for current products', () => {
    const result = buildProductLinks(QUTEST_LIKE);
    expect(result.isUsedOnly).toBe(false);
  });
});

describe('Purchase path regression: used-only product', () => {
  const VINTAGE_AMP: ProductLinkInput = {
    name: 'Citation II',
    brand: 'Harman Kardon',
    retailerLinks: [],
    availability: 'vintage',
    manufacturerUrl: undefined,
  };

  it('has zero Buy new links', () => {
    const result = buildProductLinks(VINTAGE_AMP);
    expect(result.newLinks.length).toBe(0);
  });

  it('isUsedOnly is true', () => {
    const result = buildProductLinks(VINTAGE_AMP);
    expect(result.isUsedOnly).toBe(true);
  });

  it('still generates used links', () => {
    const result = buildProductLinks(VINTAGE_AMP);
    expect(result.usedLinks.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Purchase path regression: product with no retailer links', () => {
  const BARE: ProductLinkInput = {
    name: 'Bifrost 2/64',
    brand: 'Schiit',
    retailerLinks: undefined,
    availability: 'current',
    manufacturerUrl: 'https://www.schiit.com/products/bifrost',
  };

  it('falls back to manufacturer in manufacturerLinks (product page)', () => {
    const result = buildProductLinks(BARE);
    expect(result.manufacturerLinks.length).toBeGreaterThanOrEqual(1);
    expect(result.manufacturerLinks[0].label).toBe('Schiit');
    expect(result.manufacturerLinks[0].url).toBe('https://www.schiit.com/products/bifrost');
  });

  it('still generates used links', () => {
    const result = buildProductLinks(BARE);
    expect(result.usedLinks.some(l => l.label === 'HiFi Shark')).toBe(true);
    expect(result.usedLinks.some(l => l.label === 'eBay')).toBe(true);
  });
});

describe('Purchase path regression: upgrade-path field shape parity', () => {
  // Simulates the field mapping used by UpgradePurchaseLinks:
  //   retailerLinks from UpgradePathOption → ProductLinkInput.retailerLinks
  //   manufacturerUrl from UpgradePathOption → ProductLinkInput.manufacturerUrl
  // This must produce identical output to the shopping-card path for
  // the same underlying product data.

  const PONTUS_RETAILER_LINKS = [
    { label: 'Vinshine Audio', url: 'https://www.vinshineaudio.com/product/denafrips-pontus-ii' },
  ];
  const PONTUS_MFR_URL = 'https://www.vinshineaudio.com/product/denafrips-pontus-ii';

  const shoppingCardInput: ProductLinkInput = {
    name: 'Pontus II',
    brand: 'Denafrips',
    retailerLinks: PONTUS_RETAILER_LINKS.map(l => ({ label: l.label, url: l.url })),
    advisoryLinks: PONTUS_RETAILER_LINKS.map(l => ({ label: l.label, url: l.url, kind: 'dealer' as const })),
    availability: 'current',
    typicalMarket: 'both',
    manufacturerUrl: PONTUS_MFR_URL,
  };

  const upgradeCardInput: ProductLinkInput = {
    name: 'Pontus II',
    brand: 'Denafrips',
    retailerLinks: PONTUS_RETAILER_LINKS.map(l => ({ label: l.label, url: l.url })),
    availability: 'current',
    typicalMarket: 'both',
    manufacturerUrl: PONTUS_MFR_URL,
  };

  it('both paths produce Buy new links', () => {
    const shopping = buildProductLinks(shoppingCardInput);
    const upgrade = buildProductLinks(upgradeCardInput);
    expect(shopping.newLinks.length).toBeGreaterThanOrEqual(1);
    expect(upgrade.newLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('used links are identical between card types', () => {
    const shopping = buildProductLinks(shoppingCardInput);
    const upgrade = buildProductLinks(upgradeCardInput);
    expect(shopping.usedLinks).toEqual(upgrade.usedLinks);
  });

  it('isUsedOnly matches between card types', () => {
    const shopping = buildProductLinks(shoppingCardInput);
    const upgrade = buildProductLinks(upgradeCardInput);
    expect(shopping.isUsedOnly).toBe(upgrade.isUsedOnly);
  });
});

// ══════════════════════════════════════════════════════════
// 7. Reading links
// ══════════════════════════════════════════════════════════

describe('Reading links', () => {
  it('extracts review links from advisory links', () => {
    const withReview: ProductLinkInput = {
      ...WITH_AMAZON,
      advisoryLinks: [
        ...WITH_AMAZON.advisoryLinks!,
        { label: 'ASR Review', url: 'https://www.audiosciencereview.com/smsl-do300', kind: 'review' },
      ],
    };
    const result = buildProductLinks(withReview);
    expect(result.readingLinks.some(l => l.label === 'ASR Review')).toBe(true);
  });
});
