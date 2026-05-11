/**
 * Audio XX — Cultural significance / philosophical-school metadata.
 *
 * Purpose:
 *   The recommendation pipeline today scores products via trait
 *   alignment + budget fit + system coherence + reviewer-acclaim.
 *   `scoreReviewerAcclaim` rewards products with rich
 *   `sourceReferences`, which structurally favours mainstream brands
 *   with broader review coverage. The discontinued / vintage penalty
 *   (−0.3 / −0.2) further disadvantages culturally important
 *   classics. The net effect is a quiet bias toward
 *   "metadata-rich, mainstream, structurally-clean" products at the
 *   expense of brands that are philosophically distinct but
 *   sparser-data — Leben, Shindo, Yamamoto, ampsandsound, First Watt,
 *   etc.
 *
 *   This module supplies a small counter-weight. It tags brands (and,
 *   where needed, specific products) with a cultural-significance
 *   class and a corresponding score boost. The boost is comparable in
 *   magnitude to `scoreReviewerAcclaim` (up to +0.5), so a
 *   sparse-data culturally-important product can compete on equal
 *   footing with a metadata-rich mainstream product — without being
 *   over-promoted.
 *
 * Scope (smallest safe):
 *   - Brand-level tags. Per-product overrides exist for cases where
 *     a brand spans multiple eras (e.g. "vintage Yamamoto only").
 *   - Three significance classes:
 *       'historic'              — brand defined a category or sound
 *       'enthusiast-relevant'   — distinctive identity, valued by
 *                                 experienced listeners despite niche
 *                                 distribution
 *       'design-original'       — topology / engineering distinct
 *                                 enough that it represents its own
 *                                 school
 *   - Brands can carry multiple classes.
 *   - No popularity / review-count / affiliate scoring.
 *
 * Out of scope:
 *   - Adding new product entries to the catalog. Brands not yet in
 *     the catalog (e.g. Air Tight, Kondo, Auditorium 23) are tagged
 *     here so that *when* a curator adds them, the boost applies
 *     immediately. Until then the tag has no runtime effect.
 *   - Per-product tagging of every catalog entry. Brand-level
 *     defaults cover most cases; per-product overrides are added
 *     only where genuinely needed.
 *
 * Engineering-vs-domain boundary (per CLAUDE.md § 8):
 *   This is adapter-layer content. The engine's scoring primitive
 *   (`scoreProduct`) consumes the brand-keyed boost as a number; the
 *   audio-domain knowledge of which brands carry which classes lives
 *   here.
 */

export type SignificanceClass =
  | 'historic'
  | 'enthusiast-relevant'
  | 'design-original';

export interface SignificanceTag {
  /** One or more significance classes a brand carries. */
  readonly classes: ReadonlyArray<SignificanceClass>;
  /**
   * Short editorial rationale. Surfaced in logging only — no UI
   * exposure. Helps a curator audit the map without code-reading.
   */
  readonly rationale: string;
}

/**
 * Brand-keyed significance tags. Keys are lowercase canonical brand
 * names; matched against `Product.brand.toLowerCase()`. Order does
 * not matter — first hit wins.
 *
 * Brands tagged here are intended to receive the same score-bump as
 * a reviewer-acclaim-rich mainstream product. The boost is additive,
 * not multiplicative — it does not stack with itself.
 */
const BRAND_SIGNIFICANCE: ReadonlyMap<string, SignificanceTag> = new Map([
  // ── Japanese reference tube / SET / boutique ──────────
  ['shindo', {
    classes: ['historic', 'enthusiast-relevant', 'design-original'],
    rationale:
      'Ken Shindo per-circuit design, hand-wound transformers, NOS tube selection. Reference for the integrated-system tube school. Limited annual production.',
  }],
  ['shindo laboratory', {
    classes: ['historic', 'enthusiast-relevant', 'design-original'],
    rationale: 'Same as shindo (alias).',
  }],
  ['leben', {
    classes: ['enthusiast-relevant', 'design-original'],
    rationale:
      'Japanese push-pull tube reference distinct from SET. Rhythmic articulation through KT77/KT88 push-pull dynamics at modest power.',
  }],
  ['air tight', {
    classes: ['historic', 'enthusiast-relevant'],
    rationale:
      'Japanese tube reference. ATM-1, ATM-3, ATM-211 are reference designs. Not yet in catalog — tag is pre-populated for future addition.',
  }],
  ['kondo', {
    classes: ['historic', 'enthusiast-relevant', 'design-original'],
    rationale:
      'Audio Note Japan lineage. Silver-wired, ultra-low-feedback SET reference. Not yet in catalog.',
  }],
  ['yamamoto', {
    classes: ['enthusiast-relevant', 'design-original'],
    rationale:
      'Boutique Japanese single-ended designs (45, 2A3, 300B). Wood chassis, point-to-point, low-power. Pairs with very high-efficiency speakers.',
  }],
  ['yamamoto sound craft', {
    classes: ['enthusiast-relevant', 'design-original'],
    rationale: 'Alias for yamamoto.',
  }],

  // ── US / EU boutique tube + SET ───────────────────────
  ['ampsandsound', {
    classes: ['enthusiast-relevant', 'design-original'],
    rationale:
      'Justin Weber\'s hand-built single-ended designs. Push-pull and SET variants for high-efficiency speakers and headphones.',
  }],
  ['fi', {
    classes: ['historic', 'enthusiast-relevant'],
    rationale:
      'Don Garber\'s minimalist single-ended designs. Reference for low-power-tube-with-high-efficiency-speaker school. Not yet in catalog.',
  }],
  ['border patrol', {
    classes: ['enthusiast-relevant', 'design-original'],
    rationale:
      'Gary Dews, choke-input power supply, SET designs. Distinctive philosophical school. Not yet in catalog.',
  }],
  ['auditorium 23', {
    classes: ['enthusiast-relevant', 'design-original'],
    rationale:
      'Keith Aschenbrenner\'s SET / transformer-coupled designs paired with classic / high-efficiency speakers. Not yet in catalog.',
  }],
  ['first watt', {
    classes: ['historic', 'design-original'],
    rationale:
      'Nelson Pass\'s low-power experimental sister to Pass Labs. SIT designs, single-ended class A. Listed already; tag confirms significance.',
  }],

  // ── Audio Note family (UK / Japan lineages, complex) ──
  ['audio note', {
    classes: ['historic', 'enthusiast-relevant', 'design-original'],
    rationale:
      'Audio Note UK + Japan lineages share NOS conversion + low-feedback + high-efficiency pairing philosophy. System-level identity.',
  }],
  ['audio note uk', {
    classes: ['historic', 'enthusiast-relevant', 'design-original'],
    rationale: 'Alias for audio note (UK lineage).',
  }],
  ['ank', {
    classes: ['enthusiast-relevant', 'design-original'],
    rationale:
      'Audio Note Kits — DIY-oriented variants of the Audio Note philosophy. Distinctive school within the broader Audio Note lineage.',
  }],

  // ── Speakers — high-efficiency / SET-paired traditions ──
  ['devore fidelity', {
    classes: ['enthusiast-relevant', 'design-original'],
    rationale:
      'John DeVore voiced-by-ear philosophy. Orangutan series is the canonical low-power-tube partner. Counters measurement-target speaker bias.',
  }],
  ['devore', {
    classes: ['enthusiast-relevant', 'design-original'],
    rationale: 'Alias for devore fidelity.',
  }],
  ['hornshoppe', {
    classes: ['enthusiast-relevant', 'design-original'],
    rationale:
      'Single-driver Fostex-based horns. Distinct from multi-driver horn stereotype. Niche but important within the single-driver school.',
  }],
  ['cube audio', {
    classes: ['enthusiast-relevant', 'design-original'],
    rationale:
      'Single-driver high-efficiency designs. Nenuphar / Nendo are reference for the single-driver school.',
  }],
  ['ocellia', {
    classes: ['enthusiast-relevant', 'design-original'],
    rationale:
      'French single-driver / high-efficiency tradition. Distinctive within the SET-paired speaker school.',
  }],

  // ── DAC: distinctive philosophical schools, sparser data ──
  ['totaldac', {
    classes: ['enthusiast-relevant', 'design-original'],
    rationale:
      'Discrete R2R with per-unit voicing. Boutique production. Vinyl-leaning transient timing.',
  }],
  ['mhdt', {
    classes: ['enthusiast-relevant', 'design-original'],
    rationale:
      'NOS + tube-output combination. Distinctive school at sub-flagship pricing.',
  }],
  ['mhdt labs', {
    classes: ['enthusiast-relevant', 'design-original'],
    rationale: 'Alias for mhdt.',
  }],
  ['rockna', {
    classes: ['enthusiast-relevant', 'design-original'],
    rationale:
      'Neutral-R2R interpretation, distinct from the warmth-leaning Denafrips/Holo school. Underrepresented in mainstream reviews.',
  }],
  ['laiv', {
    classes: ['enthusiast-relevant'],
    rationale:
      'Boutique R2R DAC; smaller-brand alternative to Denafrips/Holo with sparse review consensus.',
  }],

  // ── Speakers: BBC-lineage + niche reference ────────────
  ['harbeth', {
    classes: ['historic', 'enthusiast-relevant'],
    rationale:
      'BBC-lineage RADIAL midrange reference. Underrepresented in flagship-oriented shopping lists despite reference status.',
  }],
  ['spendor classic', {
    classes: ['historic'],
    rationale:
      'BBC-lineage Classic line (Spendor SP series). Sparser data than the contemporary D/A line.',
  }],
  ['falcon acoustics', {
    classes: ['historic'],
    rationale:
      'LS3/5a heritage. BBC-monitor lineage. Not always in catalog.',
  }],
]);

// ── Per-product overrides ──────────────────────────────
//
// Used when a brand carries mixed eras / lines where only some
// products warrant significance tagging. Keyed by lowercase
// "brand + name". Empty by default — added only when a brand-level
// tag is too coarse.
const PRODUCT_SIGNIFICANCE: ReadonlyMap<string, SignificanceTag> = new Map([
  // (intentionally empty at launch — most cases are well-served by
  // brand-level tagging)
]);

/**
 * Look up the significance tag for a product. Returns null when no
 * tag applies.
 *
 * Resolution order:
 *   1. Per-product override (lowercase "brand + name")
 *   2. Per-brand tag (lowercase brand name)
 *   3. null
 *
 * Tolerant matching: brand is normalized to lowercase, trimmed.
 */
export function getSignificanceTag(
  brand: string | undefined,
  name: string | undefined,
): SignificanceTag | null {
  if (!brand) return null;
  const b = brand.toLowerCase().trim();
  if (!b) return null;
  if (name) {
    const productKey = `${b} ${name.toLowerCase().trim()}`;
    const productHit = PRODUCT_SIGNIFICANCE.get(productKey);
    if (productHit) return productHit;
  }
  return BRAND_SIGNIFICANCE.get(b) ?? null;
}

/**
 * Score contribution from cultural-significance tagging.
 *
 * Magnitude is comparable to `scoreReviewerAcclaim` (which caps at
 * +0.5). The boost evens the playing field for sparse-data
 * culturally-important products without rewarding popularity per se.
 *
 * Class weights:
 *   - historic              → +0.20
 *   - design-original       → +0.20
 *   - enthusiast-relevant   → +0.10
 *
 * A brand carrying all three classes receives at most +0.50.
 *
 * This is a one-sided correction: untagged products lose nothing.
 * Tagged products gain a small, capped bonus that lets them compete
 * on trait alignment rather than on metadata richness.
 */
export function scoreCulturalSignificance(
  brand: string | undefined,
  name: string | undefined,
): number {
  const tag = getSignificanceTag(brand, name);
  if (!tag) return 0;
  let score = 0;
  for (const cls of tag.classes) {
    if (cls === 'historic') score += 0.20;
    else if (cls === 'design-original') score += 0.20;
    else if (cls === 'enthusiast-relevant') score += 0.10;
  }
  return Math.min(score, 0.50);
}

/**
 * Diagnostic: list every brand currently tagged. Used by the audit
 * harness to confirm coverage and by tests to verify expected brands
 * are present.
 */
export function listTaggedBrands(): ReadonlyArray<string> {
  return Array.from(BRAND_SIGNIFICANCE.keys()).sort();
}
