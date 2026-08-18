/**
 * Manufacturer evidence — first-party published fact.
 *
 * SITE-LEVEL product knowledge, not an assessment feature. Storage is keyed by
 * product identity, acquisition is reachable wherever an identity resolves,
 * and the reasoning path is a CONSUMER that reads and never populates. Nothing
 * here presupposes a chain, a role or a listener: role belongs to a component
 * in a system, sensitivity belongs to a loudspeaker.
 *
 * Its own regime, its own store, its own governance — see `evidence-types.ts`
 * for why that separation is preserved while the consumption shape is shared.
 *
 * SCOPE, deliberately narrow: specification, construction and topology only.
 * A manufacturer's marketing prose about how a product sounds is not a
 * manufacturer FACT, and admitting it would launder advertising into evidence
 * wearing a first-party badge. `sensitivity: 96 dB/W/M` is admissible;
 * "breathtaking transparency" is not, however first-party its source.
 */

import {
  CLASS_TIER, isAdmissible,
  type EvidenceItem, type EvidenceTier,
} from './evidence-types';

/** Controlled vocabulary. Anything not on this list is not returned. */
export const MANUFACTURER_FACT_FIELDS = [
  'sensitivity', 'impedance', 'power_output', 'power_handling',
  'frequency_response', 'dimensions', 'weight',
  'topology', 'cabinet_material', 'driver_complement',
  'tube_complement', 'inputs', 'outputs',
] as const;

export type ManufacturerFactField = typeof MANUFACTURER_FACT_FIELDS[number];

export function isManufacturerFactField(v: string): v is ManufacturerFactField {
  return (MANUFACTURER_FACT_FIELDS as readonly string[]).includes(v);
}

/**
 * Words marking a sonic or evaluative claim rather than a specification.
 *
 * The failure this prevents would be hard to see later: a manufacturer writes
 * "the 96 dB sensitivity delivers breathtaking dynamics", and the sonic half
 * arrives carrying the specification's authority.
 */
const SONIC_OR_EVALUATIVE =
  /\b(?:sound|sonic|musical|warm|bright|detailed|transparen\w*|natural|lifelike|breathtaking|stunning|effortless|engaging|immersive|liquid|airy|refined|best|finest|unrivall?ed|reference[- ]grade|award)\b/i;

/**
 * Is this candidate admissible as a manufacturer fact?
 *
 * Form only. Whether the manufacturer is telling the truth about their own
 * product is not a question this layer can settle, and the requirement to
 * quote is what lets a human settle it later.
 */
export function isManufacturerFactAcceptable(
  candidate: {
    field?: string;
    value?: string;
    sourceUrl?: string;
    quotedText?: string;
  },
  /**
   * The product this fact is claimed about. Required to check that the source
   * is first-party — without it there is no way to tell a maker's own page
   * from a mirror of it.
   */
  productName?: string,
): boolean {
  if (!candidate?.field || !isManufacturerFactField(candidate.field)) return false;
  if (!candidate.value?.trim()) return false;
  if (!candidate.quotedText?.trim()) return false;

  // Same first-party discipline as corroboration: a URL with prose attached is
  // a defective reply, not a source.
  const url = candidate.sourceUrl ?? '';
  if (!url || /\s/.test(url)) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  } catch { return false; }

  // FIRST-PARTY DOMAIN. The instruction to use the maker's own site is not
  // enforcement: live acquisition returned Klipsch Cornwall IV specifications
  // read off manualzz.com, a third-party document mirror. The figures were
  // probably right, and that is beside the point — the whole licence of this
  // regime is that the maker published it, so a mirror is a different
  // provenance regime wearing this one's badge.
  if (productName && !isFirstPartySource(url, productName)) return false;

  if (SONIC_OR_EVALUATIVE.test(candidate.value)) return false;
  // The quote must actually contain the value, or it is not its source.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!norm(candidate.quotedText).includes(norm(candidate.value))) return false;

  return true;
}

/**
 * Is this source the maker's own?
 *
 * Exported because it must run on READ as well as on write. Rows admitted
 * before this rule existed are still in the store — live production served
 * manualzz.com Klipsch specs from cache after the write-side fix landed —
 * and re-checking on read retires them without a destructive cleanup. The
 * storage key carries the product identity, so the check needs nothing the
 * store does not already hold.
 */
export function isFirstPartySource(sourceUrl: string, productNameOrKey: string): boolean {
  if (!sourceUrl || /\s/.test(sourceUrl)) return false;
  let host: string;
  try {
    const u = new URL(sourceUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    host = u.host;
  } catch { return false; }

  const hostKey = host.toLowerCase().replace(/[^a-z0-9]/g, '');
  const tokens = productKeyFor(productNameOrKey)
    .split(/[\s/-]+/)
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t));
  return tokens.some((t) => hostKey.includes(t));
}

/** Normalise a product identity into the storage key. */
export function productKeyFor(name: string): string {
  return name.toLowerCase().replace(/[^\w\s/-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Lift an accepted fact into the common interface. */
export function toEvidenceItem(
  productName: string,
  fact: { field: ManufacturerFactField; value: string; sourceUrl: string; quotedText: string },
  retrievedAt: number,
): EvidenceItem {
  return {
    productKey: productKeyFor(productName),
    evidenceClass: 'manufacturer',
    tier: CLASS_TIER.manufacturer,
    // Always product scope. A manufacturer publishes about the thing they
    // made, never about their catalogue in general.
    scope: 'product',
    field: fact.field,
    value: fact.value,
    attribution: { sourceUrl: fact.sourceUrl, quotedText: fact.quotedText },
    retrievedAt,
  };
}

export function admit(items: EvidenceItem[]): EvidenceItem[] {
  return items.filter(isAdmissible);
}

// ── Consumption ─────────────────────────────────────────────────────

/**
 * Parsed, not interpreted. "96 dB/W/M" becomes 96. The published units stay on
 * the EvidenceItem; this is only the numeric projection a comparison needs.
 * Returns undefined rather than guessing — a figure we cannot parse is a
 * figure we do not hold, which the constraint layer already handles.
 */
export function numericFigure(item: EvidenceItem): number | undefined {
  const m = item.value.match(/-?\d+(?:\.\d+)?/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : undefined;
}

export interface PhysicalFacts {
  sensitivityDb?: number;
  impedanceOhms?: number;
  powerWatts?: number;
  source: Record<string, string>;
}

/**
 * The adapter the constraint layer consumes, so `classifyPowerMatch` never has
 * to know what an EvidenceItem is and the evidence layer never has to know
 * what an amplifier is.
 */
export function physicalFactsFor(items: EvidenceItem[]): PhysicalFacts {
  const out: PhysicalFacts = { source: {} };
  for (const item of items) {
    if (item.evidenceClass !== 'manufacturer') continue;
    const n = numericFigure(item);
    if (n === undefined) continue;
    if (item.field === 'sensitivity' && out.sensitivityDb === undefined) {
      out.sensitivityDb = n;
      out.source.sensitivity = item.attribution?.sourceUrl ?? '';
    } else if (item.field === 'impedance' && out.impedanceOhms === undefined) {
      out.impedanceOhms = n;
      out.source.impedance = item.attribution?.sourceUrl ?? '';
    } else if (item.field === 'power_output' && out.powerWatts === undefined) {
      out.powerWatts = n;
      out.source.power_output = item.attribution?.sourceUrl ?? '';
    }
  }
  return out;
}

/** Exposed so no consumer quietly assumes `catalog` for a page read today. */
export const MANUFACTURER_TIER: EvidenceTier = CLASS_TIER.manufacturer;
