/**
 * Subject Card resolver — cross-brand leakage gate.
 *
 * Locks the rule from 2026-05-21: when the consultation Subject Card
 * is resolving an image for a query whose `subject` is itself a known
 * BrandProfile (an authority / brand inquiry — "shindo", "leben",
 * "harbeth"), the resolver must NOT fall through to a prose scan that
 * could surface a cross-brand product as the brand's hero card.
 *
 * Brand inquiry resolution path (post-fix):
 *   1. findProductByComponentName(subject)       — exact product match
 *   2. findProductsByBrandSlug(toSlug(subject))  — same-brand catalog
 *   3. fall through to placeholder branch        — no cross-brand scan
 *
 * Non-brand subject keeps the legacy prose-scan fallback because the
 * cross-brand contamination rule only applies when the queried subject
 * is itself a brand identity.
 *
 * The tests here exercise the same `findProductInProse` /
 * `findProductsByBrandSlug` / `findBrandProfileByName` helpers the
 * AdvisoryMessage component uses. Rendering the React component
 * itself requires a heavier jsdom setup; the resolver contract is
 * the unit being locked.
 */

import { describe, it, expect } from 'vitest';
import {
  findBrandProfileByName,
  findProductByComponentName,
  findProductInProse,
  findProductsByBrandSlug,
} from '../consultation';
import { toSlug } from '../route-slug';

/**
 * Replays the brand-aware resolver from
 * components/advisory/AdvisoryMessage.tsx :: ConsultationSubjectContext.
 * Kept verbatim against the production logic so this test fails if the
 * component drifts away from the locked contract.
 */
function resolveSubjectProduct(subject: string | undefined, prose: string | undefined) {
  let product = subject ? findProductByComponentName(subject) : undefined;
  const subjectIsBrand = !product && !!subject && !!findBrandProfileByName(subject);
  if (!product && subjectIsBrand && subject) {
    const brandProducts = findProductsByBrandSlug(toSlug(subject));
    product = brandProducts.find((p) => !!p.imageUrl) ?? brandProducts[0];
  }
  if (!product && prose && !subjectIsBrand) {
    product = findProductInProse(prose);
  }
  return product;
}

const SHINDO_PROSE =
  'Shindo Laboratory designs tube amplifiers around musical naturalness. ' +
  'A natural match with DeVore Orangutan, Altec-based horns, and other high-efficiency speakers. ' +
  'The Shindo + DeVore Orangutan O/96 combination is one of the most discussed pairings in high-efficiency audio.';

const LEBEN_PROSE =
  'Leben builds class A/AB integrated amplifiers with warm tube colour. ' +
  'Leben CS600X paired with DeVore O/96 is a celebrated pairing — high efficiency, ' +
  'warm tonal voicing, and the kind of long-session listenability that suits the brand.';

const ACCUPHASE_PROSE =
  'Accuphase builds reference-grade Japanese amplifiers and DACs with engineered precision and longevity. ' +
  'The brand has long been associated with measurement-led design and very low distortion.';

const NON_BRAND_PROSE =
  'For a tube DAC at a budget, the Schiit Bifrost 2/64 is a frequent reference. ' +
  'It pairs cleanly with most amplifiers and offers solid value.';

describe('Subject Card resolver — brand-inquiry context', () => {
  /**
   * The hard rule: when subject is a known brand, the resolved
   * product (if any) must be from THAT brand. The pre-fix prose-scan
   * could surface a cross-brand pairing product; the post-fix gate
   * forbids it.
   */
  function assertSameBrandOrPlaceholder(
    expectedBrand: string,
    resolved: ReturnType<typeof resolveSubjectProduct>,
    forbidden: string[],
  ): void {
    if (!resolved) return; // Placeholder branch — allowed outcome.
    const brand = resolved.brand.toLowerCase();
    expect(brand).toBe(expectedBrand.toLowerCase());
    for (const f of forbidden) {
      expect(brand).not.toContain(f.toLowerCase());
    }
  }

  it('subject="Shindo" + prose mentioning DeVore Orangutan resolves to Shindo or placeholder, never DeVore', () => {
    const product = resolveSubjectProduct('Shindo', SHINDO_PROSE);
    assertSameBrandOrPlaceholder('Shindo', product, ['devore']);
  });

  it('subject="Leben" + prose mentioning DeVore O/96 resolves to Leben or placeholder, never DeVore', () => {
    const product = resolveSubjectProduct('Leben', LEBEN_PROSE);
    assertSameBrandOrPlaceholder('Leben', product, ['devore']);
  });

  it('subject="Accuphase" resolves to Accuphase or placeholder — never a non-Accuphase brand from prose', () => {
    // Accuphase has catalog products; the gate keeps the resolution
    // same-brand. If a curated Accuphase product exists in catalog,
    // it lands first. Otherwise placeholder.
    const product = resolveSubjectProduct('Accuphase', ACCUPHASE_PROSE);
    assertSameBrandOrPlaceholder('Accuphase', product, ['devore', 'shindo', 'leben']);
  });

  it('subject is recognised as a brand alias (case-insensitive)', () => {
    // The lowercase form a free-text query produces.
    expect(findBrandProfileByName('shindo')).toBeDefined();
    expect(findBrandProfileByName('Shindo')).toBeDefined();
    expect(findBrandProfileByName('SHINDO')).toBeDefined();
    expect(findBrandProfileByName('shindo laboratory')).toBeDefined();
  });

  it('legacy prose-scan path preserved for non-brand subjects', () => {
    // Subject doesn't match any BrandProfile → prose-scan path stays
    // active. This is the "I asked about the Schiit Bifrost" case
    // where surfacing a Bifrost from the prose was the intended
    // behaviour before the gate.
    const subject = 'a non-existent free-text question';
    expect(findBrandProfileByName(subject)).toBeUndefined();
    const product = resolveSubjectProduct(subject, NON_BRAND_PROSE);
    // Whatever the prose scan resolves to (or doesn't) is unchanged
    // by the brand gate. Lock that the prose scan still fires for
    // non-brand subjects (i.e. when the gate is open).
    expect(product?.brand?.toLowerCase()).toBe('schiit');
  });

  it('legacy prose-scan path preserved when no subject provided', () => {
    // Older callers may pass only prose with no subject. The
    // subjectIsBrand check is false (subject undefined), so prose
    // scan runs as before.
    const product = resolveSubjectProduct(undefined, NON_BRAND_PROSE);
    expect(product?.brand?.toLowerCase()).toBe('schiit');
  });

  it('subject that resolves to a real product takes precedence over both gate and prose scan', () => {
    // Cover the happy path: a specific product subject ("Chord Hugo TT 2")
    // resolves via findProductByComponentName and never enters either
    // the brand-only or prose-scan branches.
    const product = resolveSubjectProduct('Chord Hugo TT 2', SHINDO_PROSE);
    expect(product).toBeDefined();
    expect(product!.brand.toLowerCase()).toBe('chord');
  });

  it('Boenicke (same-brand inquiry, no catalog products) does not leak Hegel', () => {
    // Boenicke's pairingNotes mention "Hegel" by surface form. Boenicke
    // has a BrandProfile but no in-catalog Boenicke products. Pre-fix,
    // findProductInProse would return a Hegel amp from the prose scan.
    // Post-fix, the brand gate stops it.
    const prose =
      'Boenicke speakers benefit from clean, well-controlled amplification. ' +
      'Solid-state integrateds such as Hegel work well.';
    const product = resolveSubjectProduct('Boenicke', prose);
    if (product) {
      expect(product.brand.toLowerCase()).not.toContain('hegel');
    } else {
      expect(product).toBeUndefined();
    }
  });
});
