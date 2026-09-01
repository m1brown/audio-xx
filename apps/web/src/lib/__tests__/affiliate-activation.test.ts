/**
 * D-010 activation-readiness proof (pre-beta item 9).
 *
 * Pins both halves of the contract:
 *  1. The default deployment (no identifiers configured) generates
 *     PLAIN links and reports affiliate-inactive — the honest state.
 *  2. A configured identifier demonstrably reaches the generated URL
 *     via the NEXT_PUBLIC (client-visible) variable — the exact path
 *     the deployed app uses. Test-scoped values only; no real or fake
 *     affiliate IDs are shipped in source.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

async function freshModules() {
  vi.resetModules();
  const config = await import('../affiliate-config');
  const amazon = await import('../amazon-links');
  const ebay = await import('../ebay-links');
  return { config, amazon, ebay };
}

describe('D-010 — affiliate activation readiness', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('default state: no identifiers → plain links, affiliate inactive', async () => {
    vi.stubEnv('NEXT_PUBLIC_AMAZON_AFFILIATE_TAG', '');
    vi.stubEnv('AMAZON_AFFILIATE_TAG', '');
    vi.stubEnv('NEXT_PUBLIC_EBAY_CAMPAIGN_ID', '');
    vi.stubEnv('EBAY_CAMPAIGN_ID', '');
    const { config, amazon, ebay } = await freshModules();

    expect(config.getAmazonAffiliateTag()).toBeUndefined();
    expect(config.getEbayCampaignId()).toBeUndefined();

    const amazonUrl = amazon.getAmazonSearchUrl('D90SE', 'Topping');
    if (amazonUrl) expect(amazonUrl).not.toContain('tag=');
    const ebayUrl = ebay.getEbaySearchUrl('Topping D90SE');
    if (ebayUrl) expect(ebayUrl).not.toContain('campid=');
  });

  it('configured NEXT_PUBLIC identifiers reach the generated URLs', async () => {
    vi.stubEnv('NEXT_PUBLIC_AMAZON_AFFILIATE_TAG', 'testtag-20');
    vi.stubEnv('NEXT_PUBLIC_EBAY_CAMPAIGN_ID', '5338000000');
    const { config, amazon, ebay } = await freshModules();

    expect(config.getAmazonAffiliateTag()).toBe('testtag-20');
    expect(config.getEbayCampaignId()).toBe('5338000000');

    const amazonUrl = amazon.getAmazonSearchUrl('D90SE', 'Topping');
    if (amazonUrl) expect(amazonUrl).toContain('tag=testtag-20');
    const ebayUrl = ebay.getEbaySearchUrl('Topping D90SE');
    if (ebayUrl) expect(ebayUrl).toContain('campid=5338000000');
    // At least one of the two builders must actually produce a URL for
    // this mainstream product, or the test proves nothing.
    expect(Boolean(amazonUrl) || Boolean(ebayUrl)).toBe(true);
  });
});
