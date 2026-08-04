/**
 * Product Resources — label honesty and safe omission.
 *
 * Runs against the real catalog. The case that motivated the guard is JOB
 * Integrated: its first retailer link is a HiFi Shark search, and
 * buildProductLinks classifies any non-Amazon, non-dealer retailer link as
 * the manufacturer page — so the block shipped a used-listings search under
 * the label "Manufacturer".
 */
import { describe, it, expect } from 'vitest';
import { buildProductResources } from '../product-resources';

const AGGREGATORS = /hifishark\.com|ebay\.|audiogon\.com|usaudiomart\.com|reverb\.com/i;

describe('buildProductResources', () => {
  it('never labels an aggregator or marketplace as "Manufacturer"', () => {
    const out = buildProductResources({
      componentNames: ['Chord Hugo', 'JOB Integrated', 'WLM Diva Monitor'],
    });
    expect(out.length).toBeGreaterThan(0);
    for (const r of out) {
      const m = r.links.find((l) => l.label === 'Manufacturer');
      if (m) expect(m.url).not.toMatch(AGGREGATORS);
    }
  });

  it('omits a row entirely for a product not in the catalog', () => {
    const out = buildProductResources({ componentNames: ['Zzyzx Fictional 9000'] });
    expect(out).toEqual([]);
  });

  it('uses only the three approved labels, each at most once per product', () => {
    const out = buildProductResources({
      componentNames: ['Chord Hugo', 'JOB Integrated', 'WLM Diva Monitor'],
    });
    for (const r of out) {
      const labels = r.links.map((l) => l.label);
      expect(new Set(labels).size).toBe(labels.length);
      for (const l of labels) expect(['Manufacturer', 'Buy New', 'Used Market']).toContain(l);
    }
  });

  it('emits no duplicate URLs within a product row', () => {
    const out = buildProductResources({ componentNames: ['Chord Hugo', 'JOB Integrated'] });
    for (const r of out) {
      const urls = r.links.map((l) => l.url);
      expect(new Set(urls).size).toBe(urls.length);
    }
  });

  it('deduplicates repeated products and caps the list', () => {
    const out = buildProductResources({ componentNames: Array(20).fill('Chord Hugo') });
    expect(out.length).toBe(1);
  });

  it('is safe on empty input', () => {
    expect(buildProductResources({})).toEqual([]);
  });
});
