import { describe, it, expect } from 'vitest';
import {
  shouldShowAmazonLink,
  getAmazonSearchUrl,
  getAffiliateTag,
} from '../amazon-links';

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
      expect(url).toContain('tag=audioxx-20');
    });

    it('generates a search URL with name only', () => {
      const url = getAmazonSearchUrl('H190');
      expect(url).toContain('k=H190');
      expect(url).toContain('tag=audioxx-20');
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
      expect(getAffiliateTag()).toBe('audioxx-20');
    });
  });
});
