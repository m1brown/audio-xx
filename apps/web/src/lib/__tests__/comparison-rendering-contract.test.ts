/**
 * Comparison rendering contract — regression test.
 *
 * Locks the field-routing rules that `gearResponseToAdvisory` must hold
 * for `StandardFormat`'s rich comparison block to render. A previous
 * regression populated `philosophy` (used by single-product gear inquiry)
 * but not `comparisonSummary` (the gate for the comparison-with-images
 * layout), causing the comparison output to fall back to flat prose.
 *
 * Scope: pure unit test on the adapter. No renderer, no app/page,
 * no snapshot. Asserts behavioral contracts only.
 */

import { describe, it, expect } from 'vitest';

import { gearResponseToAdvisory } from '../advisory-response';
import type { GearResponse } from '../conversation-types';
import type { Product } from '../products/dacs';

// ── Minimal Product fixtures ──────────────────────────
//
// Constructed with the smallest set of fields required by Product so the
// adapter can run end-to-end. `imageUrl` is set explicitly so the
// resolveProductImage chain has a non-fallback first hop.

function fixtureProduct(overrides: Partial<Product> & Pick<Product, 'id' | 'brand' | 'name'>): Product {
  return {
    id: overrides.id,
    brand: overrides.brand,
    name: overrides.name,
    price: 1500,
    category: 'dac',
    architecture: 'fpga',
    traits: {},
    description: 'Test fixture product.',
    retailer_links: [],
    ...overrides,
  };
}

const PRODUCT_A: Product = fixtureProduct({
  id: 'fixture-chord-qutest',
  brand: 'Chord',
  name: 'Qutest',
  imageUrl: 'https://example.test/qutest.jpg',
  sourceReferences: [
    { source: 'Darko.Audio', note: 'Review covering FPGA timing.', url: 'https://darko.audio/qutest' },
  ],
});

const PRODUCT_B: Product = fixtureProduct({
  id: 'fixture-denafrips-pontus',
  brand: 'Denafrips',
  name: 'Pontus II',
  architecture: 'r2r',
  imageUrl: 'https://example.test/pontus.jpg',
  sourceReferences: [
    { source: 'HiFi News', note: 'R2R ladder review.', url: 'https://hifinews.example/pontus' },
  ],
});

// ── GearResponse fixtures ─────────────────────────────

const COMPARISON_ANCHOR =
  'Chord Qutest vs Denafrips Pontus II — FPGA precision against R2R density.';
const COMPARISON_CHARACTER =
  'Qutest leans transient-fast and lean; Pontus leans dense and tonally rich.';
const COMPARISON_DIRECTION =
  'Pick by which pole your system already lacks.';

function comparisonGearResponse(): GearResponse {
  return {
    intent: 'comparison',
    anchor: COMPARISON_ANCHOR,
    character: COMPARISON_CHARACTER,
    direction: COMPARISON_DIRECTION,
    subjects: ['Chord Qutest', 'Denafrips Pontus II'],
    matchedProducts: [PRODUCT_A, PRODUCT_B],
  };
}

// Non-comparison control: a single-product gear inquiry. The same anchor
// prose must route to `philosophy`, not `comparisonSummary`.

function gearInquiryResponse(): GearResponse {
  return {
    intent: 'gear_question',
    anchor: 'The Qutest is Chord\'s entry-level desktop DAC.',
    character: 'Detailed, fast, precise timing.',
    direction: 'A natural step if you value transient speed.',
    subjects: ['Chord Qutest'],
    matchedProducts: [PRODUCT_A],
  };
}

// ── Tests ─────────────────────────────────────────────

describe('gearResponseToAdvisory — comparison rendering contract', () => {
  it('routes comparison anchor prose to comparisonSummary, not philosophy', () => {
    const advisory = gearResponseToAdvisory(comparisonGearResponse());

    // The gate StandardFormat reads — must be set so the comparison block renders.
    expect(advisory.comparisonSummary).toBe(COMPARISON_ANCHOR);

    // Must NOT also be on philosophy (would mean fallback prose layout was selected).
    if (advisory.philosophy !== undefined) {
      expect(advisory.philosophy).not.toBe(COMPARISON_ANCHOR);
    }
  });

  it('populates comparisonImages for at least two products when image data exists', () => {
    const advisory = gearResponseToAdvisory(comparisonGearResponse());

    expect(advisory.comparisonImages).toBeDefined();
    expect(advisory.comparisonImages!.length).toBeGreaterThanOrEqual(2);

    const identities = advisory.comparisonImages!.map(
      (img) => `${img.brand} ${img.name}`.toLowerCase(),
    );
    expect(identities).toContain('chord qutest');
    expect(identities).toContain('denafrips pontus ii');

    // Each entry must carry a resolvable imageUrl string (the resolver
    // chain may fall back to placeholders, but the field must be present
    // for the comparison block to render image slots).
    for (const img of advisory.comparisonImages!) {
      expect(typeof img.imageUrl).toBe('string');
      expect(img.imageUrl!.length).toBeGreaterThan(0);
    }
  });

  it('preserves sourceReferences when products carry them', () => {
    const advisory = gearResponseToAdvisory(comparisonGearResponse());

    expect(advisory.sourceReferences).toBeDefined();
    expect(advisory.sourceReferences!.length).toBeGreaterThan(0);
    const sources = advisory.sourceReferences!.map((r) => r.source);
    expect(sources).toContain('Darko.Audio');
    expect(sources).toContain('HiFi News');
  });

  it('sets advisoryMode to gear_comparison so dispatch hits the comparison renderer', () => {
    const advisory = gearResponseToAdvisory(comparisonGearResponse());
    expect(advisory.advisoryMode).toBe('gear_comparison');
  });

  it('still produces a comparisonSummary when matchedProducts is missing (no images, but block stays gated correctly)', () => {
    const noProducts = comparisonGearResponse();
    delete noProducts.matchedProducts;

    const advisory = gearResponseToAdvisory(noProducts);
    expect(advisory.comparisonSummary).toBe(COMPARISON_ANCHOR);
    // No products → no images, but comparisonSummary still set so the
    // text-only comparison framing renders (degraded, not absent).
    expect(advisory.comparisonImages).toBeUndefined();
  });
});

describe('gearResponseToAdvisory — non-comparison control', () => {
  it('single-product gear inquiry routes anchor to philosophy, not comparisonSummary', () => {
    const advisory = gearResponseToAdvisory(gearInquiryResponse());

    // Single-product path: anchor is the philosophy prose.
    expect(advisory.philosophy).toBe(gearInquiryResponse().anchor);

    // Comparison fields must be absent so StandardFormat doesn't try to
    // render the comparison block on a single-product response.
    expect(advisory.comparisonSummary).toBeUndefined();
    expect(advisory.comparisonImages).toBeUndefined();
  });

  it('single-product gear inquiry uses gear_advice mode, not gear_comparison', () => {
    const advisory = gearResponseToAdvisory(gearInquiryResponse());
    expect(advisory.advisoryMode).toBe('gear_advice');
  });
});
