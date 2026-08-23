/**
 * System components as they reach the screen.
 *
 * GOVERNING INVARIANT (founder, 2026-08-16):
 *
 *   A system is a collection of component identities. No downstream surface
 *   may collapse those identities into a synthetic product.
 *
 * The violation this exists to end: `llm-system-inference.ts` set
 * `subject: componentNames.join(', ')`, and every downstream surface treats a
 * subject as ONE product. Image lookup, HiFiShark, eBay and the Subject Card
 * all received the string
 *
 *   "dCS Rossini Apex + ARC ref 5 + Butler Monads + Acora QRC-2"
 *
 * — a product that does not exist. No image could match it, so the whole
 * system fell back to a generic placeholder even though the dCS may well have
 * an approved image; and the commerce links searched a marketplace for a
 * four-headed product.
 *
 * This is a PROJECTION of the authoritative graph, not a second component
 * model. It carries only what the screen needs — identity, role, evidence
 * basis, and the per-component links — and each field is resolved
 * independently so that failure degrades per component. A missing Acora image
 * must never suppress the dCS image.
 *
 * Nothing here decides authority. `basis` arrives already computed by
 * `computeComponentProvenance` from what Audio XX actually holds; this module
 * may not promote a component to make the display tidier.
 */

import { resolveProductImageStrict } from './product-images';
import { buildProductLinks } from './product-links';

export type EvidenceBasis = 'catalog' | 'brand' | 'model' | 'user';

/** One component, as presented. */
export interface SystemComponentView {
  /** Identity shown to the reader — canonical when corroborated, else the listener's words. */
  displayName: string;
  /** Exactly as the listener wrote it. Never overwritten. */
  listenerName: string;
  /** Functional role from the explicit label or the catalog. */
  role: string;
  /** Reader-facing role, stating both jobs for a multi-role component. */
  roleDisplay: string;
  basis: EvidenceBasis;
  brand?: string;
  /** F4-gated. Undefined is a legitimate outcome, not a failure. */
  imageUrl?: string;
  hifiSharkUrl?: string;
  ebayUrl?: string;
  /**
   * The identity used for marketplace queries. Canonical whenever corroboration
   * established one, because "Reference 5" finds listings that "ARC ref 5"
   * does not. Kept separate from `displayName` so searching better never
   * requires rewriting what the listener sees.
   */
  searchIdentity?: string;
}

/** Source shape — the authoritative graph node, plus what provenance computed. */
export interface ComponentSource {
  displayName: string;
  role: string;
  roles?: string[];
  product?: { brand: string; name: string; imageUrl?: string };
  brandProfile?: unknown;
  /** Canonical manufacturer designation, when corroboration established one. */
  canonicalName?: string;
  canonicalBrand?: string;
}

const ROLE_LABEL: Record<string, string> = {
  dac: 'DAC',
  streamer: 'Streamer',
  source: 'Source',
  transport: 'Transport',
  preamplifier: 'Preamplifier',
  amplifier: 'Power amplifier',
  integrated: 'Integrated amplifier',
  speaker: 'Loudspeaker',
  headphone: 'Headphones',
  turntable: 'Turntable',
  cartridge: 'Cartridge',
  tonearm: 'Tonearm',
  phono: 'Phono stage',
};

/**
 * A component with several roles states them together — the listener who wrote
 * "DAC/Streamer:" described one box doing two jobs, and flattening that back to
 * a single role discards what they told us.
 */
export function roleLabel(role: string, roles?: string[]): string {
  if (roles && roles.length > 1) {
    const labels = roles
      .filter((r) => ROLE_LABEL[r])
      .slice(0, 2)
      .map((r) => ROLE_LABEL[r]);
    if (labels.length > 1) return labels.join(' / ');
  }
  return ROLE_LABEL[role] ?? role;
}

/** Split a user-supplied name for resolvers that expect brand and model apart. */
function splitName(displayName: string): { brand?: string; name: string } {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length < 2) return { name: displayName };
  return { brand: parts[0], name: parts.slice(1).join(' ') };
}

/**
 * Marketplace queries reach a search box, not a resolver.
 *
 * Corroboration returns manufacturer strings, and manufacturers use typographic
 * characters that no listing title contains: `Acora Acoustics QRC\u20112` carries a
 * non-breaking hyphen, `Audio Research Reference\u00a05` a non-breaking space. Sent
 * verbatim they match nothing.
 */
function normalizeForSearch(value: string): string {
  return value
    // Parenthetical asides — the corroborator returned
    // "Butler Audio (BK Butler)", which is useful provenance and useless as a
    // query.
    .replace(/\s*\([^)]*\)/g, '')
    // Non-breaking, figure, en and em dashes and minus sign → plain hyphen.
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-')
    // Non-breaking, narrow and thin spaces → plain space.
    .replace(/[\u00a0\u202f\u2007\u2009]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Category nouns a manufacturer's page title carries and a component card does not. */
const CATEGORY_NOUN =
  /(?:^|\s+)(?:amplifier|amp|preamplifier|preamp|power amplifier|integrated amplifier|loudspeaker|loudspeakers|speaker|speakers|dac|d\/a converter|digital to analogue converter|streamer|network player|turntable|cartridge|tonearm|phono stage|line[- ]?stage(?: preamplifier)?|monoblock|monoblocks|stereo preamplifier|floorstanding speaker)$/i;

/**
 * The canonical name as a component card should show it.
 *
 * Returns undefined when nothing usable survives, which the caller reads as
 * "keep the listener's words" — the safe default, since their words are always
 * a true record of what they own.
 */
function cleanCanonicalForDisplay(canonicalName?: string, canonicalBrand?: string): string | undefined {
  let v = normalizeForSearch(canonicalName ?? '');
  if (!v) return undefined;
  // One pass only, with compound suffixes ("Line-Stage Preamplifier") matched
  // whole. Eroding a word at a time would keep going and take the model
  // designation with it.
  v = v.replace(CATEGORY_NOUN, '').trim();
  if (!v) return undefined;

  // Restore the brand when the manufacturer's own title omits it — their page
  // does not need to say "Butler", a card next to three other brands does.
  const brand = canonicalBrand ? searchableBrand(canonicalBrand) : '';
  if (brand) {
    const first = brand.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const already = v.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ')
      .some((t) => t === first);
    if (!already) v = `${brand} ${v}`;
  }
  return v.trim() || undefined;
}

/**
 * Corporate suffixes are how a company signs a contract, not how a listing is
 * titled. Nobody sells an "Audio Research Corporation Reference 5".
 */
function searchableBrand(brand: string): string {
  return normalizeForSearch(brand)
    .replace(/\s*\b(?:corporation|corp|incorporated|inc|company|co|limited|ltd|llc|gmbh|s\.?a\.?s?|b\.?v\.?|kk|k\.k\.)\b\.?$/i, '')
    .trim();
}

/**
 * Separate a canonical identity into brand and model.
 *
 * `splitName` assumes the brand is exactly one word. That held while identities
 * were the listener's shorthand and broke the moment corroboration supplied
 * real manufacturer names: with brand `Audio Research Corporation` and identity
 * `Audio Research Reference 5`, taking the first token left `Research Reference
 * 5` as the model, and the query became
 *
 *   Audio Research Corporation Research Reference 5
 *
 * Three of the four beta components searched a duplicated brand this way. The
 * fix is to remove the brand PREFIX rather than a fixed number of words, and
 * only when it is genuinely a prefix — `MONAD A100` under brand `Butler Audio`
 * shares no leading token, so nothing is stripped and the brand is prepended
 * once by the link builder.
 */
function splitCanonical(identity: string, brand?: string): { brand?: string; name: string } {
  const id = normalizeForSearch(identity);
  const b = brand ? normalizeForSearch(brand) : undefined;
  if (!b) return splitName(id);

  // Longest matching prefix of the brand's tokens, so `Audio Research
  // Corporation` still strips `Audio Research` from the identity.
  const brandTokens = b.split(' ');
  const idTokens = id.split(' ');
  let matched = 0;
  while (
    matched < brandTokens.length
    && matched < idTokens.length
    && brandTokens[matched].toLowerCase().replace(/[^a-z0-9]/g, '')
      === idTokens[matched].toLowerCase().replace(/[^a-z0-9]/g, '')
  ) matched++;

  const remainder = idTokens.slice(matched).join(' ').trim();
  // Everything matched — the identity is the brand and nothing else. Keep the
  // identity as the model so the query is not empty.
  return { brand: b, name: remainder || id };
}

/**
 * Build one presentation per component.
 *
 * Every resolution is per component and independent. An empty image, a missing
 * brand, or an uncorroborated identity affects only its own entry.
 */
export function buildComponentViews(
  components: ComponentSource[],
  provenance: Array<{ name: string; basis: EvidenceBasis }> | undefined,
): SystemComponentView[] {
  const basisByName = new Map(
    (provenance ?? []).map((p) => [p.name.toLowerCase().trim(), p.basis]),
  );

  return components.map((c) => {
    const listenerName = c.displayName;
    // Canonical identity wins for DISPLAY and for marketplace queries, because
    // it is the manufacturer's own designation and searches better. The
    // listener's words are kept so nothing they typed is lost.
    // THREE identities, deliberately distinct:
    //   listenerName   — verbatim, never overwritten
    //   displayName    — what the card shows
    //   searchIdentity — what HiFiShark and eBay receive
    //
    // Display upgrades to the canonical form ONLY when that form carries
    // strictly more identifying information — resolving an abbreviation or
    // adding a model designation ("ARC ref 5" -> "Audio Research Reference 5").
    // A mere case or spacing variant ("dCS Rossini Apex" -> "dCS Rossini APEX")
    // is not an improvement, and silently restyling what someone typed reads as
    // the product correcting them.
    //
    // Word count alone is not informativeness. Corroboration returns whatever
    // the manufacturer's page is titled, and across three consecutive
    // production runs the same amplifier came back as "MONAD A100", "MONAD
    // (The One) amplifier" and "MONAD (The One)". The middle one has more
    // words than "Butler Monads" and so replaced it on the card — a noisier
    // string that had also lost the brand.
    //
    // So the candidate is cleaned first (marketing parentheticals and a
    // trailing category noun removed), the brand is restored when the
    // manufacturer's title omits it, and only then is it compared.
    const canonical = cleanCanonicalForDisplay(c.canonicalName, c.canonicalBrand);
    const informative = (v?: string) =>
      (v ?? '').trim().split(/\s+/).filter(Boolean).length;
    const displayName = canonical && informative(canonical) > informative(listenerName)
      ? canonical
      : listenerName;
    const searchIdentity = normalizeForSearch(canonical || listenerName);

    const brand = c.product?.brand ?? c.canonicalBrand ?? splitName(displayName).brand;
    const modelName = c.product?.name ?? splitName(displayName).name;
    // Marketplace queries use the canonical identity; display does not have to.
    // A catalogued product already carries a clean brand/model pair, so it is
    // used as-is; everything else is split against the canonical brand rather
    // than by counting words.
    const canonicalSplit = splitCanonical(searchIdentity, c.canonicalBrand);
    const searchBrand = c.product?.brand
      ?? (c.canonicalBrand ? searchableBrand(c.canonicalBrand) : undefined)
      ?? canonicalSplit.brand;
    const searchModel = c.product?.name ?? canonicalSplit.name;

    // F4 gate lives inside getProductImage. A catalogued product may carry its
    // own imageUrl; anything else must come through the curated overlay or not
    // at all. Corroboration is NOT image permission.
    const imageUrl = resolveProductImageStrict(brand, modelName, c.product?.imageUrl);

    let hifiSharkUrl: string | undefined;
    let ebayUrl: string | undefined;
    try {
      const links = buildProductLinks({ brand: searchBrand, name: searchModel });
      hifiSharkUrl = links.usedLinks.find((l) => /hifishark/i.test(l.url))?.url;
      ebayUrl = links.usedLinks.find((l) => /ebay\./i.test(l.url))?.url;
    } catch {
      // Commerce links are conveniences and carry no evidentiary weight;
      // failing to build one must never affect the assessment.
    }

    return {
      displayName,
      listenerName,
      role: c.role,
      roleDisplay: roleLabel(c.role, c.roles),
      basis: basisByName.get(listenerName.toLowerCase().trim()) ?? 'user',
      brand,
      searchIdentity,
      imageUrl,
      hifiSharkUrl,
      ebayUrl,
    };
  });
}
