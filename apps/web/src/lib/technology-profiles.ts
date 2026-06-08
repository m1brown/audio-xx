/**
 * Audio XX — Technology Profiles data layer.
 *
 * Sibling to BRAND_PROFILES in consultation.ts. Where BrandProfile carries
 * the editorial argument a manufacturer makes, TechnologyProfile carries
 * the editorial argument a topology / approach / school-of-design makes —
 * SET (Single-Ended Triode), NOS DACs, R2R DACs, Step-Up Transformers,
 * Class A Amplification, High-Efficiency Loudspeakers, etc.
 *
 * The shape is deliberately scoped to what a Technology Page actually
 * renders, and mirrors BrandProfile field-for-field where editorial intent
 * overlaps. Brand-specific fields (founder / country / brandScale /
 * categories / designFamilies) are intentionally absent — a technology
 * has no founder country and no product lineages.
 *
 * Schema membership comment on the EditorialEntity / shared-base question:
 *   The shared base interface is DEFERRED until a second Technology Page
 *   ships (NOS DACs is the natural second). With two technology pages in
 *   code, the shared fields between BrandProfile and TechnologyProfile
 *   become observable and the unification can be made cleanly. Doing it
 *   now would be refactor-before-need.
 *
 * See docs/AudioXX_Advisory_Brain.md for the broader editorial doctrine
 * (brands-as-containers-for-ideas; the three editorial tests: useful /
 * valuable / insightful; the five-year thoughtful-enthusiast test).
 */

import { toSlug as routeToSlug } from './route-slug';
import type { BrandLink } from './consultation';

/**
 * A cross-link from a Technology Page to a brand or to another
 * Technology Page. The `relation` sentence is editorially required —
 * without it, the cross-link card would have to invent text or carry
 * only the target's own tagline; neither aligns with the doctrine's
 * "every section answers both what is it? and why does it matter?"
 * rule.
 */
export interface TechnologyCrossLink {
  /** Slug into BRAND_PROFILES or TECHNOLOGY_PROFILES. */
  slug: string;
  /**
   * One sentence (~12-25 words) naming the relation between this
   * Technology Page and the target. NOT a paraphrase of the target's
   * own tagline.
   */
  relation: string;
}

/**
 * A Technology Page entry.
 *
 * Renderer lives at apps/web/src/app/tech/[slug]/page.tsx (commit 2 of
 * the SET sequence). Lookup helper is `findTechnologyProfileBySlug`
 * below.
 */
export interface TechnologyProfile {
  /**
   * Aliases used for slug matching. The first alias drives the
   * canonical URL: `routeToSlug(names[0])` is the page slug. Additional
   * aliases support both common acronyms and the spelled-out form
   * (e.g. ['set', 'single-ended triode']).
   */
  names: string[];

  /**
   * Explicit canonical display form. Non-optional because every
   * Technology Page so far is an acronym or a multi-word concept where
   * `humanizeFromSlug` would produce the wrong form (SET → 'Set',
   * NOS → 'Nos'). Same field added to BrandProfile in commit 015ea1a;
   * here it is required from day one.
   */
  displayName: string;

  /**
   * Optional ≤14-word tagline. Slightly more permissive than BrandProfile
   * (12 words) since technologies sometimes need to name the trade-off
   * directly.
   */
  tagline?: string;

  /**
   * The editorial argument the technology makes. Mirrors
   * BrandProfile.philosophy in role — the first prose paragraph after
   * the hero. Names the technology AS an idea, not as a category.
   */
  philosophy: string;

  /** Extended-form philosophy. ~150-280 words. Optional. */
  philosophyExtended?: string;

  /**
   * "What it is" — the technical anchor. Distinct from philosophy
   * because the reader returning for a refresher may want the technical
   * orientation without the full argument again.
   */
  whatItIs: string;

  /**
   * "Why it matters" — the structural claim about why the technology
   * earns editorial attention. Distinct from philosophy because
   * philosophy MAKES the argument; whyItMatters STATES THE STAKE.
   */
  whyItMatters: string;

  /** Idea-gifts. 4-6 entries. Each is a sentence, not a label. */
  strengths: string[];

  /** Idea-costs. 4-5 entries. The technology's conscious trade-offs. */
  tradeoffs: string[];

  /**
   * System fit. Equivalent of BrandProfile.pairingNotes. Names idea-
   * compatibility, anti-pairings, and the canonical system the
   * technology presupposes. ~200-280 words.
   */
  systemFit: string;

  /**
   * Cross-links into BRAND_PROFILES. Order is editorial — the strongest
   * relation first. The renderer resolves each slug through
   * findBrandProfileBySlug; unresolved slugs are dropped (with a dev-
   * only console.warn so authoring drift is visible).
   */
  relatedBrandSlugs: TechnologyCrossLink[];

  /**
   * Cross-links into TECHNOLOGY_PROFILES (sibling pages). May be empty
   * on first publish of a Technology Page; fills in as siblings ship.
   * The renderer suppresses the section heading when empty.
   */
  relatedTechnologySlugs?: TechnologyCrossLink[];

  /**
   * Informational links — manufacturer educational pages, museum /
   * archival references, school-of-thought primers. Same shape as
   * BrandProfile.links; the F4 reviewer-data exclusion gate applies
   * (no `kind: 'review'` rendering).
   */
  links?: BrandLink[];

  /**
   * Schools-of-thought membership memo. Same purpose as the inline
   * `// schools:` comment on BrandProfile — authored ahead of
   * Schools-of-Thought pages so cross-links are ready when those pages
   * ship.
   *
   * Soft format ("expresses both X and Y; bridges to Z"), not hard
   * category form ("is an X-school technology"). The doctrine treats
   * schools as overlapping intellectual traditions, not partitions.
   */
  schoolsMemo?: string;

  /**
   * Optional hero image. Manufacturer-sourced, museum-sourced, or
   * Wikimedia-public-domain. Locally hosted under
   * apps/web/public/brand-heroes/ (the directory name is preserved
   * from the brand-page era to avoid a parallel directory; the
   * locality discipline is the same). F4-satisfied: not
   * reviewer-derived.
   *
   * A Technology Page MAY ship text-only on first publish (the page
   * is text-rich enough to stand without one) and add the hero in a
   * follow-up commit once a safe asset is sourced.
   */
  media?: {
    images: Array<{
      url: string;
      caption: string;
      credit: string;
      sourceUrl?: string;
    }>;
  };
}

/**
 * The Technology Profiles registry.
 *
 * Empty at commit 1 (infra). The SET entry lands in commit 3 of the
 * sequence. The order in this array is editorial — strongest /
 * earliest-shipped pages first — but the lookup helper does not depend
 * on order.
 */
export const TECHNOLOGY_PROFILES: TechnologyProfile[] = [];

/**
 * Resolve a URL slug to a TechnologyProfile. Returns undefined if no
 * profile's `names` aliases produce the requested slug.
 *
 * Mirrors `findBrandProfileBySlug` in consultation.ts: the slug is
 * matched against the slugified form of each alias, so a profile with
 * `names: ['set', 'single-ended triode']` resolves both `/tech/set`
 * and `/tech/single-ended-triode`.
 */
export function findTechnologyProfileBySlug(
  slug: string,
): TechnologyProfile | undefined {
  if (!slug) return undefined;
  return TECHNOLOGY_PROFILES.find((tp) =>
    tp.names.some((name) => routeToSlug(name) === slug),
  );
}
