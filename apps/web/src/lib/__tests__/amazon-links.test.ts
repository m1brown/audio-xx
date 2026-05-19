import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import {
  shouldShowAmazonLink,
  getAmazonSearchUrl,
  getAffiliateTag,
} from '../amazon-links';

// 2026-05-19: amazon-links now reads its tag from
// AMAZON_AFFILIATE_TAG via affiliate-config. The tests below
// explicitly set the env var so they exercise the configured
// state (the asserted contract: when tag IS configured, URLs
// include `tag=<value>`). Untagged behavior is asserted in
// public-beta-copy-and-affiliate-discipline.test.ts.
const ORIG_AMAZON_TAG = process.env.AMAZON_AFFILIATE_TAG;
beforeEach(() => {
  process.env.AMAZON_AFFILIATE_TAG = 'audioxx20-20';
});
afterEach(() => {
  if (ORIG_AMAZON_TAG === undefined) delete process.env.AMAZON_AFFILIATE_TAG;
  else process.env.AMAZON_AFFILIATE_TAG = ORIG_AMAZON_TAG;
});

describe('Amazon Links', () => {
  describe('shouldShowAmazonLink', () => {
    it('returns true for current products with non-excluded brands', () => {
      expect(shouldShowAmazonLink({ brand: 'Schiit', availability: 'current' })).toBe(true);
      expect(shouldShowAmazonLink({ brand: 'Hegel' })).toBe(true);
      expect(shouldShowAmazonLink({ brand: 'Naim', typicalMarket: 'both' })).toBe(true);
      expect(shouldShowAmazonLink({ brand: 'Klipsch', typicalMarket: 'new' })).toBe(true);
    });

    it('returns false for discontinued products', () => {
      expect(shouldShowAmazonLink({ brand: 'Schiit', availability: 'discontinued' })).toBe(false);
      expect(shouldShowAmazonLink({ brand: 'Hegel', availability: 'vintage' })).toBe(false);
    });

    it('returns false for used-only products', () => {
      expect(shouldShowAmazonLink({ brand: 'Schiit', typicalMarket: 'used' })).toBe(false);
      expect(shouldShowAmazonLink({ brand: 'Naim', buyingContext: 'used_only' })).toBe(false);
    });

    it('returns false for excluded boutique brands', () => {
      expect(shouldShowAmazonLink({ brand: 'Decware' })).toBe(false);
      expect(shouldShowAmazonLink({ brand: 'Linear Tube Audio' })).toBe(false);
      expect(shouldShowAmazonLink({ brand: 'Leben' })).toBe(false);
      expect(shouldShowAmazonLink({ brand: 'DeVore' })).toBe(false);
      expect(shouldShowAmazonLink({ brand: 'Boenicke' })).toBe(false);
      expect(shouldShowAmazonLink({ brand: 'First Watt' })).toBe(false);
    });

    it('is case-insensitive for brand matching', () => {
      expect(shouldShowAmazonLink({ brand: 'DECWARE' })).toBe(false);
      expect(shouldShowAmazonLink({ brand: 'leben' })).toBe(false);
    });

    it('returns true when brand is undefined', () => {
      expect(shouldShowAmazonLink({})).toBe(true);
    });
  });

  describe('getAmazonSearchUrl', () => {
    it('generates a search URL with brand and name', () => {
      const url = getAmazonSearchUrl('Bifrost 2/64', 'Schiit');
      expect(url).toContain('amazon.com/s');
      expect(url).toContain('k=Schiit+Bifrost+2%2F64');
      expect(url).toContain('i=electronics');
      expect(url).toContain('tag=audioxx20-20');
    });

    it('generates a search URL with name only', () => {
      const url = getAmazonSearchUrl('H190');
      expect(url).toContain('k=H190');
      expect(url).toContain('tag=audioxx20-20');
    });

    it('URL-encodes special characters', () => {
      const url = getAmazonSearchUrl('Nait XS 3', 'Naim');
      expect(url).toContain('k=Naim+Nait+XS+3');
    });

    it('scopes to electronics category', () => {
      const url = getAmazonSearchUrl('Test', 'Brand');
      expect(url).toContain('n%3A172282');
    });
  });

  describe('getAffiliateTag', () => {
    it('returns the configured tag', () => {
      expect(getAffiliateTag()).toBe('audioxx20-20');
    });
  });
});
