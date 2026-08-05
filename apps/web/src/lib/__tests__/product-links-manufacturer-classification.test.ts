/**
 * buildProductLinks — manufacturer classification (audit, 2026-08-05).
 *
 * `manufacturerLinks` feeds three render sites, and two of them label it
 * "Product page → {brand}":
 *   - AdvisoryProductCard.tsx ProductLinksSection  (recommendations, brand pages)
 *   - AdvisoryUpgradePaths.tsx UpgradePurchaseLinks (upgrade cards)
 *   - product-resources.ts                          (assessment resources)
 *
 * The link was derived as "first retailer link that is neither Amazon nor a
 * known dealer" — an open-at-the-bottom rule that classified anything
 * unrecognised as the brand's own site. 6 of 158 catalogued products have a
 * HiFi Shark search as their first retailer link, so those cards asserted
 * "Product page → JOB" over a used-listings query. Found via the Product
 * Resources block, but live on the two older surfaces well before it.
 *
 * These tests pin the closed classification at the shared builder, which is
 * where all three consumers inherit it.
 */
import { describe, it, expect } from 'vitest';
import { buildProductLinks, isAggregatorLink } from '../product-links';
import { ALL_PRODUCTS } from '../consultation';

const AGGREGATOR = /hifishark\.com|ebay\.|audiogon\.com|usaudiomart\.com|canuckaudiomart\.com|reverb\.com|etsy\.com|aliexpress\./i;

describe('isAggregatorLink', () => {
  it('recognises marketplaces and used-gear aggregators', () => {
    for (const u of [
      'https://www.hifishark.com/search?q=job+integrated',
      'https://www.ebay.com/sch/i.html?_nkw=Chord+Hugo',
      'https://www.audiogon.com/listings',
      'https://reverb.com/item/123',
    ]) expect(isAggregatorLink(u)).toBe(true);
  });

  it('does not flag genuine manufacturer sites', () => {
    for (const u of [
      'https://chordelectronics.co.uk/product/hugo/',
      'https://www.wiener-lautsprecher-manufaktur.com/en-speaker',
      'https://jobsys.com/',
      'https://lebenhifi.com/products/cs600.html',
    ]) expect(isAggregatorLink(u)).toBe(false);
  });
});

describe('manufacturer classification', () => {
  it('does not promote an aggregator retailer link to a Product page', () => {
    const r = buildProductLinks({
      name: 'Integrated',
      brand: 'JOB',
      retailerLinks: [{ label: 'Used', url: 'https://www.hifishark.com/search?q=job+integrated' }],
    });
    expect(r.manufacturerLinks).toEqual([]);
  });

  it('does not promote an aggregator passed as manufacturerUrl', () => {
    const r = buildProductLinks({
      name: 'Integrated',
      brand: 'JOB',
      manufacturerUrl: 'https://www.hifishark.com/search?q=job+integrated',
    });
    expect(r.manufacturerLinks).toEqual([]);
  });

  it('does not re-admit an aggregator through the link-less safety net', () => {
    // No dealer, no Amazon-eligible brand, nothing but an aggregator: the
    // net must leave Product page empty rather than fill it with a lie.
    const r = buildProductLinks({
      name: 'Integrated',
      brand: 'JOB',
      retailerLinks: [{ label: 'Find used', url: 'https://www.audiogon.com/listings/job' }],
      manufacturerUrl: 'https://www.audiogon.com/listings/job',
    });
    expect(r.manufacturerLinks).toEqual([]);
    // The card still has links — used-market links are always generated.
    expect(r.usedLinks.length).toBeGreaterThan(0);
  });

  it('still resolves a real manufacturer page', () => {
    const r = buildProductLinks({
      name: 'Hugo',
      brand: 'Chord',
      retailerLinks: [{ label: 'Chord', url: 'https://chordelectronics.co.uk/product/hugo/' }],
    });
    expect(r.manufacturerLinks[0]?.url).toBe('https://chordelectronics.co.uk/product/hugo/');
  });

  it('prefers a real manufacturer page over an aggregator listed first', () => {
    const r = buildProductLinks({
      name: 'CS600',
      brand: 'Leben',
      retailerLinks: [
        { label: 'Used', url: 'https://www.hifishark.com/search?q=leben+cs600' },
        { label: 'Leben', url: 'https://lebenhifi.com/products/cs600.html' },
      ],
    });
    expect(r.manufacturerLinks[0]?.url).toBe('https://lebenhifi.com/products/cs600.html');
  });

  it('releases the aggregator back to Buy used instead of consuming it', () => {
    // Previously HiFi Shark was claimed by manufacturerLinks, and the global
    // URL dedup then dropped it from usedLinks — so the one honest use of
    // that URL was lost to the mislabel.
    const r = buildProductLinks({
      name: 'Integrated',
      brand: 'JOB',
      retailerLinks: [{ label: 'Used', url: 'https://www.hifishark.com/search?q=job+integrated' }],
    });
    expect(r.usedLinks.some((l) => /hifishark/i.test(l.url))).toBe(true);
  });
});

describe('whole catalog', () => {
  it('renders no aggregator as a Product page for any catalogued product', () => {
    const offenders: string[] = [];
    for (const p of ALL_PRODUCTS as any[]) {
      const r = buildProductLinks({
        name: p.name,
        brand: p.brand,
        retailerLinks: p.retailer_links,
        availability: p.availability,
        manufacturerUrl: p.learnMore?.manufacturer ?? p.retailer_links?.[0]?.url,
        usedMarketUrl: p.learnMore?.usedMarket,
      });
      for (const l of r.manufacturerLinks) {
        if (AGGREGATOR.test(l.url)) offenders.push(`${p.brand} ${p.name} → ${l.url}`);
      }
    }
    // Was 6 before the fix: Goldmund SRDA, Scott 222B/222C, JOB Integrated,
    // Goldmund/JOB 225, Crayon CIA-1T, Trends TA-10.
    expect(offenders).toEqual([]);
  });
});
