/**
 * Upgrade-comparison data plumbing regression test.
 *
 * Locks the three fixes that closed the upgrade-comparison render gap:
 *
 *   FIX 1 — gear-response.ts upgrade branch returns
 *           `matchedProducts: [from, to]`. Without this, downstream
 *           image and link/source aggregation in
 *           `gearResponseToAdvisory` saw an empty product list and
 *           shipped advisories without images, retailer links, or
 *           source references.
 *
 *   FIX 2 — advisory-response.ts upgrade branch emits
 *           `comparisonImages`, `links`, and `sourceReferences`
 *           when matchedProducts carries them. Aggregation is hoisted
 *           above the upgradeAnalysis branch so both upgrade and
 *           general-comparison branches share the same data.
 *
 *   FIX 3 — page.tsx SET_COMPARISON dispatch fires for upgrade
 *           comparisons even when subjectMatches.length < 2 (e.g.
 *           "should I upgrade my Hugo to Hugo TT2?" produces a single
 *           brand subject). Detection now keys on
 *           `gearResponse.upgradeAnalysis && matchedProducts.length >= 2`
 *           with synthetic SubjectMatch entries derived from
 *           the from/to products.
 *
 * Scope: pure unit / integration tests on the gear-response → advisory
 * seam plus a documentation-style lock on the page-level predicate.
 * No React rendering, no full page mount.
 */

import { describe, it, expect } from 'vitest';

import { buildGearResponse } from '../gear-response';
import {
  gearResponseToAdvisory,
  type AdvisoryLink,
  type SourceReference,
} from '../advisory-response';
import { detectIntent } from '../intent';
import type { GearResponse, UpgradeAnalysis } from '../conversation-types';
import type { Product, RetailerLink } from '../products/dacs';

// ── Synthetic UpgradeAnalysis (minimal valid payload) ──

const SYNTHETIC_UPGRADE_ANALYSIS: UpgradeAnalysis = {
  systemCharacter: 'Chord FPGA lineage — incisive timing across the line.',
  workingWell: ['Transient definition', 'Coherent phase across the band'],
  limitations: ['Composure under heavy dynamic load'],
  whatChanges: 'Greater authority and tonal density at higher levels.',
  improvements: ['Effortless bass control', 'Composed dynamic peaks'],
  unchanged: ['Core timing signature', 'FPGA-driven detail retrieval'],
  whenMakesSense: 'When the system has resolved upstream and downstream limits.',
  whenToWait: 'When upstream noise floor is the actual bottleneck.',
  systemBalance: [
    { label: 'Speed / articulation', level: 'Strong' },
    { label: 'Composure', level: 'Moderate' },
  ],
  upgradeImpactAreas: ['Composure under load'],
  changeMagnitude: {
    tier: 'moderate',
    label: 'Moderate',
    changesmost: 'Authority and density.',
    remainsSimilar: 'Timing signature.',
  },
};

// ── Synthetic Product fixtures ────────────────────────
//
// Intentionally constructed so we can assert each output channel
// independently (image vs links vs source references).

const RETAILER_LINKS_FROM: RetailerLink[] = [
  { label: 'Buy at AudioAdvisor', url: 'https://example.test/from-buy' },
  { label: 'Stereophile review of FromDAC', url: 'https://example.test/from-review' },
];

const RETAILER_LINKS_TO: RetailerLink[] = [
  { label: 'Buy at Crutchfield', url: 'https://example.test/to-buy' },
];

const SOURCE_REFS_FROM = [
  { source: 'Stereophile', note: 'FromDAC review covering timing and composure.' },
];

const SOURCE_REFS_TO = [
  { source: 'HiFi News', note: 'ToDAC measurement coverage.' },
];

function makeProduct(overrides: Partial<Product> & Pick<Product, 'brand' | 'name' | 'price'>): Product {
  // Cast through `unknown` so the test fixture stays minimal — only the
  // fields the upgrade-branch advisory adapter actually reads need to be
  // present. The full Product surface is large; keeping the fixture tight
  // documents which fields the seam under test depends on.
  return {
    id: `${overrides.brand}-${overrides.name}`.toLowerCase().replace(/\s+/g, '-'),
    category: 'dac',
    architecture: 'FPGA',
    traits: {},
    description: '',
    retailer_links: [],
    ...overrides,
  } as unknown as Product;
}

const FROM_PRODUCT: Product = makeProduct({
  brand: 'Acme',
  name: 'FromDAC',
  price: 2000,
  imageUrl: 'https://example.test/from.jpg',
  retailer_links: RETAILER_LINKS_FROM,
  sourceReferences: SOURCE_REFS_FROM,
});

const TO_PRODUCT: Product = makeProduct({
  brand: 'Acme',
  name: 'ToDAC',
  price: 5000,
  imageUrl: 'https://example.test/to.jpg',
  retailer_links: RETAILER_LINKS_TO,
  sourceReferences: SOURCE_REFS_TO,
});

const PRODUCT_NO_RICHNESS: Product = makeProduct({
  brand: 'Acme',
  name: 'BareDAC',
  price: 1000,
});

function makeUpgradeGearResponse(matched: Product[]): GearResponse {
  return {
    intent: 'comparison',
    subjects: matched.map((p) => p.name),
    anchor: 'Upgrade anchor prose.',
    character: 'Upgrade character prose.',
    direction: 'Upgrade direction prose.',
    upgradeAnalysis: SYNTHETIC_UPGRADE_ANALYSIS,
    matchedProducts: matched,
  };
}

// ─────────────────────────────────────────────────────
// FIX 1 — buildGearResponse returns matchedProducts on
//         upgrade comparisons.
// ─────────────────────────────────────────────────────

describe('FIX 1 — gear-response upgrade branch carries matchedProducts', () => {
  it('"should I upgrade my Hugo to Hugo TT2?" yields matchedProducts of length 2', () => {
    const text = 'should I upgrade my Hugo to Hugo TT2?';
    const { subjects, desires } = detectIntent(text);
    const result = buildGearResponse('comparison', subjects, text, desires);

    expect(result).not.toBeNull();
    expect(result!.upgradeAnalysis).toBeDefined();
    expect(result!.matchedProducts).toBeDefined();
    expect(result!.matchedProducts!.length).toBeGreaterThanOrEqual(2);

    // Both Chord products surface in the carried pair (order-agnostic —
    // from/to is decided by price + active system, not subject order).
    const names = result!.matchedProducts!
      .map((p) => p.name.toLowerCase())
      .join('|');
    expect(names).toContain('hugo');
    expect(names).toContain('hugo tt2');
  });

  it('upgrade comparison carries the from/to pair as the first two matchedProducts', () => {
    const text = 'compare Hugo to Hugo TT2 — should I upgrade?';
    const { subjects, desires } = detectIntent(text);
    const result = buildGearResponse('comparison', subjects, text, desires);

    expect(result).not.toBeNull();
    expect(result!.upgradeAnalysis).toBeDefined();
    const matched = result!.matchedProducts ?? [];
    expect(matched.length).toBeGreaterThanOrEqual(2);

    // The first two entries are the comparison pair (not arbitrary
    // related-products padding from a different code path).
    const firstTwo = matched.slice(0, 2).map((p) => p.name.toLowerCase());
    expect(firstTwo).toContain('hugo');
    expect(firstTwo).toContain('hugo tt2');
  });
});

// ─────────────────────────────────────────────────────
// FIX 2 — gearResponseToAdvisory upgrade branch emits
//         comparisonImages, links, and sourceReferences
//         when products carry them.
// ─────────────────────────────────────────────────────

describe('FIX 2 — gearResponseToAdvisory upgrade branch enriches output from matchedProducts', () => {
  it('emits comparisonImages with two entries when two products are present', () => {
    const gear = makeUpgradeGearResponse([FROM_PRODUCT, TO_PRODUCT]);
    const advisory = gearResponseToAdvisory(gear);

    expect(advisory.comparisonImages).toBeDefined();
    expect(advisory.comparisonImages!.length).toBe(2);
    expect(advisory.comparisonImages![0].brand).toBe('Acme');
    expect(advisory.comparisonImages![0].name).toBe('FromDAC');
    expect(advisory.comparisonImages![1].name).toBe('ToDAC');
  });

  it('emits links aggregated from both products when retailer_links are present', () => {
    const gear = makeUpgradeGearResponse([FROM_PRODUCT, TO_PRODUCT]);
    const advisory = gearResponseToAdvisory(gear);

    expect(advisory.links).toBeDefined();
    const urls = (advisory.links as AdvisoryLink[]).map((l) => l.url);
    expect(urls).toContain('https://example.test/from-buy');
    expect(urls).toContain('https://example.test/from-review');
    expect(urls).toContain('https://example.test/to-buy');
  });

  it('classifies "review" links via the "review" label substring', () => {
    const gear = makeUpgradeGearResponse([FROM_PRODUCT, TO_PRODUCT]);
    const advisory = gearResponseToAdvisory(gear);

    const reviewLink = (advisory.links as AdvisoryLink[]).find(
      (l) => l.url === 'https://example.test/from-review',
    );
    expect(reviewLink).toBeDefined();
    expect(reviewLink!.kind).toBe('review');

    const buyLink = (advisory.links as AdvisoryLink[]).find(
      (l) => l.url === 'https://example.test/from-buy',
    );
    expect(buyLink).toBeDefined();
    expect(buyLink!.kind).toBe('reference');
  });

  it('emits sourceReferences aggregated from both products', () => {
    const gear = makeUpgradeGearResponse([FROM_PRODUCT, TO_PRODUCT]);
    const advisory = gearResponseToAdvisory(gear);

    expect(advisory.sourceReferences).toBeDefined();
    const sourceNames = (advisory.sourceReferences as SourceReference[]).map((s) => s.source);
    expect(sourceNames).toContain('Stereophile');
    expect(sourceNames).toContain('HiFi News');
  });

  it('deduplicates sourceReferences when both products cite the same source', () => {
    const dupSource = { source: 'Stereophile', note: 'Different note, same source.' };
    const a = makeProduct({
      brand: 'Acme', name: 'A', price: 1000, sourceReferences: [SOURCE_REFS_FROM[0]],
    });
    const b = makeProduct({
      brand: 'Acme', name: 'B', price: 2000, sourceReferences: [dupSource],
    });

    const gear = makeUpgradeGearResponse([a, b]);
    const advisory = gearResponseToAdvisory(gear);

    const sources = advisory.sourceReferences as SourceReference[];
    const stereophileEntries = sources.filter((s) => s.source === 'Stereophile');
    expect(stereophileEntries.length).toBe(1);
  });

  it('still produces a valid advisory when matchedProducts have no retailer_links or sources', () => {
    const a = PRODUCT_NO_RICHNESS;
    const b = makeProduct({ brand: 'Acme', name: 'OtherBare', price: 2000 });
    const gear = makeUpgradeGearResponse([a, b]);
    const advisory = gearResponseToAdvisory(gear);

    // Graceful degradation — the renderer's "both must have imageUrl" gate
    // can fall back to text-only comparison without throwing.
    expect(advisory).toBeDefined();
    expect(advisory.comparisonImages).toBeDefined();
    expect(advisory.comparisonImages!.length).toBe(2);
    // No retailer_links → links should be undefined (not an empty array)
    expect(advisory.links).toBeUndefined();
    expect(advisory.sourceReferences).toBeUndefined();
  });

  it('does not emit comparisonImages for non-comparison upgrade flows', () => {
    // Non-comparison upgrade (intent: 'gear_inquiry') still goes through the
    // upgradeAnalysis branch but should NOT populate comparisonImages.
    const gear: GearResponse = {
      ...makeUpgradeGearResponse([FROM_PRODUCT, TO_PRODUCT]),
      intent: 'gear_inquiry',
    };
    const advisory = gearResponseToAdvisory(gear);
    expect(advisory.comparisonImages).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────
// FIX 3 — Page-level SET_COMPARISON gate detects upgrade
//         comparisons and synthesizes the from/to pair.
//
// Tested as a pure predicate that mirrors the inline logic
// in apps/web/src/app/page.tsx (lines ~2231-2253). If the
// page's logic changes, mirror it here.
// ─────────────────────────────────────────────────────

type SubjectMatchLike = { name: string; kind: 'product' | 'brand' };

interface DispatchPredicateResult {
  isUpgradeComparison: boolean;
  isSubjectMatchedComparison: boolean;
  shouldDispatchSetComparison: boolean;
  derivedLeft?: SubjectMatchLike;
  derivedRight?: SubjectMatchLike;
  derivedScope?: 'brand' | 'product';
}

/**
 * Mirror of the SET_COMPARISON gate in page.tsx.
 *
 * Locked in this file as a pure function so we can lock the predicate
 * separately from the React dispatch. If the page's gate changes,
 * change this function too — the duplication is the contract.
 */
function pageDispatchPredicate(
  intent: string,
  gearResponse: { upgradeAnalysis?: unknown; matchedProducts?: Product[] },
  subjectMatches: SubjectMatchLike[],
): DispatchPredicateResult {
  const matchedLen = gearResponse.matchedProducts?.length ?? 0;
  const isUpgradeComparison = !!gearResponse.upgradeAnalysis && matchedLen >= 2;
  const isSubjectMatchedComparison = intent === 'comparison' && subjectMatches.length >= 2;
  const shouldDispatchSetComparison = isUpgradeComparison || isSubjectMatchedComparison;

  let derivedLeft: SubjectMatchLike | undefined;
  let derivedRight: SubjectMatchLike | undefined;
  let derivedScope: 'brand' | 'product' | undefined;

  if (shouldDispatchSetComparison) {
    if (isUpgradeComparison && gearResponse.matchedProducts && gearResponse.matchedProducts.length >= 2) {
      const [from, to] = gearResponse.matchedProducts;
      derivedLeft = { name: from.name, kind: 'product' };
      derivedRight = { name: to.name, kind: 'product' };
      derivedScope = 'product';
    } else if (subjectMatches.length >= 2) {
      derivedLeft = subjectMatches[0];
      derivedRight = subjectMatches[1];
      derivedScope = subjectMatches.every((m) => m.kind === 'product') ? 'product' : 'brand';
    }
  }

  return {
    isUpgradeComparison,
    isSubjectMatchedComparison,
    shouldDispatchSetComparison,
    derivedLeft,
    derivedRight,
    derivedScope,
  };
}

describe('FIX 3 — page-level SET_COMPARISON gate (predicate locked to page.tsx)', () => {
  it('fires for upgrade comparisons with single-brand subject (the regression case)', () => {
    // The exact case that was broken: user types "should I upgrade my Hugo
    // to Hugo TT2?" → intent is 'comparison' but only one subject
    // ("chord") is matched as a brand. Old gate (subjectMatches.length >= 2)
    // refused to fire. New gate keys on gearResponse.upgradeAnalysis +
    // matchedProducts.length >= 2.
    const gearResponse = {
      upgradeAnalysis: SYNTHETIC_UPGRADE_ANALYSIS,
      matchedProducts: [FROM_PRODUCT, TO_PRODUCT],
    };
    const subjectMatches: SubjectMatchLike[] = [{ name: 'acme', kind: 'brand' }];

    const r = pageDispatchPredicate('comparison', gearResponse, subjectMatches);

    expect(r.isUpgradeComparison).toBe(true);
    expect(r.isSubjectMatchedComparison).toBe(false);
    expect(r.shouldDispatchSetComparison).toBe(true);
    expect(r.derivedLeft).toEqual({ name: 'FromDAC', kind: 'product' });
    expect(r.derivedRight).toEqual({ name: 'ToDAC', kind: 'product' });
    expect(r.derivedScope).toBe('product');
  });

  it('still fires for general comparisons via the subjectMatches path', () => {
    const gearResponse = { matchedProducts: [FROM_PRODUCT, TO_PRODUCT] };
    const subjectMatches: SubjectMatchLike[] = [
      { name: 'chord', kind: 'brand' },
      { name: 'denafrips', kind: 'brand' },
    ];

    const r = pageDispatchPredicate('comparison', gearResponse, subjectMatches);

    expect(r.isUpgradeComparison).toBe(false);
    expect(r.isSubjectMatchedComparison).toBe(true);
    expect(r.shouldDispatchSetComparison).toBe(true);
    expect(r.derivedLeft).toEqual({ name: 'chord', kind: 'brand' });
    expect(r.derivedRight).toEqual({ name: 'denafrips', kind: 'brand' });
    expect(r.derivedScope).toBe('brand');
  });

  it('does not fire when neither condition holds', () => {
    const gearResponse = { matchedProducts: [FROM_PRODUCT] };
    const subjectMatches: SubjectMatchLike[] = [{ name: 'chord', kind: 'brand' }];

    const r = pageDispatchPredicate('gear_inquiry', gearResponse, subjectMatches);

    expect(r.isUpgradeComparison).toBe(false);
    expect(r.isSubjectMatchedComparison).toBe(false);
    expect(r.shouldDispatchSetComparison).toBe(false);
  });

  it('does not fire when upgradeAnalysis exists but matchedProducts has < 2 entries', () => {
    // Defensive: a malformed GearResponse with upgradeAnalysis but only
    // one matched product should NOT trigger SET_COMPARISON. Otherwise
    // we'd dispatch undefined as `right`.
    const gearResponse = {
      upgradeAnalysis: SYNTHETIC_UPGRADE_ANALYSIS,
      matchedProducts: [FROM_PRODUCT],
    };
    const r = pageDispatchPredicate('comparison', gearResponse, []);
    expect(r.isUpgradeComparison).toBe(false);
    expect(r.shouldDispatchSetComparison).toBe(false);
  });

  it('prefers the upgrade-comparison from/to pair over subjectMatches when both apply', () => {
    // Edge case: upgrade comparison detected AND two subjects matched.
    // Upgrade comparison wins (it's the actual decision pair).
    const gearResponse = {
      upgradeAnalysis: SYNTHETIC_UPGRADE_ANALYSIS,
      matchedProducts: [FROM_PRODUCT, TO_PRODUCT],
    };
    const subjectMatches: SubjectMatchLike[] = [
      { name: 'chord', kind: 'brand' },
      { name: 'denafrips', kind: 'brand' },
    ];

    const r = pageDispatchPredicate('comparison', gearResponse, subjectMatches);

    expect(r.shouldDispatchSetComparison).toBe(true);
    expect(r.derivedLeft).toEqual({ name: 'FromDAC', kind: 'product' });
    expect(r.derivedRight).toEqual({ name: 'ToDAC', kind: 'product' });
    expect(r.derivedScope).toBe('product');
  });
});
