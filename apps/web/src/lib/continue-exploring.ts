/**
 * "Continue Exploring" — the related-reading section closing an assessment,
 * recommendation, comparison or purchase answer.
 *
 * The one hard rule is that a link must resolve. Every href here is checked
 * against the data that backs the route before it is emitted, and a group
 * with nothing in it is dropped rather than shown empty. That matters more
 * than coverage: a dead link in an editorial section costs more trust than
 * a missing one.
 *
 * Route reality as of this pass:
 *   /brand/[slug] — 60 curated profiles. NOTE: this route does not call
 *     notFound(); an unknown slug renders a hollow 200. So the existence
 *     check here is load-bearing, not belt-and-braces.
 *   /tech/[slug]  — 8 idea pages (schools, topologies, formats).
 *   products      — no route exists. `/product/[brand]/[name]` is a stub
 *     that renders "coming soon" for any slug pair, and brand-page product
 *     cards carry no anchors. So there is nothing to link a product to and
 *     the Products group stays empty by construction. See resolveProducts.
 */
import { findBrandProfileBySlug } from '@/lib/catalog/lookups';
import { TECHNOLOGY_PROFILES, findTechnologyProfileBySlug } from '@/lib/technology-profiles';
import { toSlug } from '@/lib/route-slug';
import { toDisplayName } from '@/lib/canonical-names';

export interface ExploreLink {
  label: string;
  href: string;
}

export interface ExploreGroup {
  title: string;
  links: ExploreLink[];
}

export interface ContinueExploringInput {
  /** Product / component names named this turn, e.g. "Chord Hugo". */
  componentNames?: string[];
  /** Brand names the engine already resolved, e.g. "Eversolo". */
  brandNames?: string[];
  /** Response prose — scanned only to match idea pages by name. */
  prose?: string;
}

/** Per-group cap. Beyond this the section stops guiding and starts listing. */
const MAX_PER_GROUP = 6;

/**
 * Short technology aliases that are also ordinary English ("set", "nos").
 * Matching these case-insensitively against prose produces false links —
 * "the system is set up" is not a case for /tech/set. They are matched only
 * as exact uppercase acronyms.
 */
const ACRONYM_MIN_LENGTH = 6;

function isAcronymAlias(alias: string): boolean {
  return alias.length < ACRONYM_MIN_LENGTH;
}

/**
 * Resolve a brand from a component name by trying progressively shorter
 * leading word runs: "Chord Electronics Hugo TT" → "chord electronics hugo
 * tt", "chord electronics hugo", "chord electronics", "chord". Longest
 * match wins so "Audio Note" does not resolve as "Audio".
 */
function brandFromName(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  for (let n = Math.min(words.length, 4); n >= 1; n--) {
    const profile = findBrandProfileBySlug(toSlug(words.slice(0, n).join(' ')));
    if (profile) return profile;
  }
  return undefined;
}

/**
 * Reader-facing name for a brand.
 *
 * Most profiles carry no `displayName`, and `names[0]` is the slug source —
 * lowercase, and often the short alias ("chord", "wlm"). Running the
 * FULLEST alias through the canonical-name table recovers the published
 * form: "chord electronics" → "Chord Electronics", "wlm" → "WLM".
 */
function brandLabel(profile: { displayName?: string; names: string[] }): string {
  if (profile.displayName) return profile.displayName;
  const fullest = [...profile.names].sort((a, b) => b.length - a.length)[0];
  return toDisplayName(fullest);
}

/**
 * Products. Empty by construction — see the module header. Kept as a named
 * seam so that when a real product route exists this becomes a lookup and
 * the render layer needs no change.
 */
function resolveProducts(_input: ContinueExploringInput): ExploreLink[] {
  return [];
}

function resolveManufacturers(input: ContinueExploringInput): ExploreLink[] {
  const seen = new Set<string>();
  const out: ExploreLink[] = [];
  const candidates = [...(input.brandNames ?? []), ...(input.componentNames ?? [])];
  for (const c of candidates) {
    if (!c?.trim()) continue;
    const profile = brandFromName(c);
    if (!profile) continue;
    // names[0] is the canonical slug source; aliases resolve but are not canonical.
    const href = `/brand/${toSlug(profile.names[0])}`;
    if (seen.has(href)) continue;
    seen.add(href);
    out.push({ label: brandLabel(profile), href });
    if (out.length >= MAX_PER_GROUP) break;
  }
  return out;
}

function resolveIdeas(input: ContinueExploringInput, brands: ExploreLink[]): ExploreLink[] {
  const seen = new Set<string>();
  const out: ExploreLink[] = [];

  const push = (slug: string) => {
    const tp = findTechnologyProfileBySlug(slug);
    if (!tp) return;
    const href = `/tech/${toSlug(tp.names[0])}`;
    if (seen.has(href)) return;
    seen.add(href);
    out.push({ label: tp.displayName, href });
  };

  // 1. Authored links from the brand profiles already on screen. These are
  //    editorially chosen, so they lead.
  for (const b of brands) {
    const profile = findBrandProfileBySlug(b.href.replace('/brand/', ''));
    for (const slug of profile?.relatedTechnologySlugs ?? []) push(slug);
  }

  // 2. Idea pages named in the answer itself.
  const haystack = [...(input.componentNames ?? []), input.prose ?? ''].join(' ');
  if (haystack.trim()) {
    const lower = haystack.toLowerCase();
    for (const tp of TECHNOLOGY_PROFILES) {
      const hit = tp.names.some((alias) =>
        isAcronymAlias(alias)
          // Short aliases match only as an exact uppercase acronym.
          ? new RegExp(`\\b${alias.toUpperCase()}\\b`).test(haystack)
          : new RegExp(`\\b${alias.toLowerCase().replace(/[-\s]+/g, '[-\\s]+')}\\b`).test(lower),
      );
      if (hit) push(toSlug(tp.names[0]));
    }
  }

  return out.slice(0, MAX_PER_GROUP);
}

/**
 * Build the section. Returns only groups with at least one resolving link;
 * an empty array means the section should not render at all.
 */
export function buildContinueExploring(input: ContinueExploringInput): ExploreGroup[] {
  const products = resolveProducts(input);
  const manufacturers = resolveManufacturers(input);
  const ideas = resolveIdeas(input, manufacturers);

  return [
    { title: 'Products', links: products },
    { title: 'Manufacturers', links: manufacturers },
    { title: 'Ideas', links: ideas },
  ].filter((g) => g.links.length > 0);
}
