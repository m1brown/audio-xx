/**
 * Catalog typeahead search (MVP M1 — Build Your System).
 *
 * Pure, synchronous search over the committed static index
 * (catalog-index.json, generated from the product modules by
 * scripts/generate-catalog-index.ts). Bundled with the client so
 * suggestions are instant and work without any API or database.
 */
import CATALOG from './catalog-index.json';

export interface CatalogEntry {
  id: string;
  brand: string;
  name: string;
  category: string;
}

export const CATALOG_ENTRIES: CatalogEntry[] = CATALOG as CatalogEntry[];

/** Listener-facing category labels for suggestion rows. */
const CATEGORY_LABELS: Record<string, string> = {
  dac: 'DAC',
  amplifier: 'Amplifier',
  speaker: 'Speakers',
  headphone: 'Headphones',
  iem: 'In-ears',
  streamer: 'Streamer',
  turntable: 'Turntable',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/** Display form used to fill the builder field and compose engine text. */
export function displayName(e: CatalogEntry): string {
  // Avoid "Schiit Schiit Modius" when the model name already leads with the brand.
  return e.name.toLowerCase().startsWith(e.brand.toLowerCase())
    ? e.name
    : `${e.brand} ${e.name}`;
}

/**
 * Rank an entry against a query. Lower is better; null = no match.
 * Every query token must match somewhere in "brand name"; word-prefix
 * matches rank above mid-word substrings so "pon" finds "Pontus II"
 * before anything containing "…pon…".
 */
function score(e: CatalogEntry, tokens: string[]): number | null {
  const hay = `${e.brand} ${e.name}`.toLowerCase();
  const words = hay.split(/[^a-z0-9+]+/).filter(Boolean);
  let total = 0;
  for (const t of tokens) {
    if (words.some((w) => w.startsWith(t))) {
      total += 0;
    } else if (hay.includes(t)) {
      total += 1;
    } else {
      return null;
    }
  }
  // Whole-query prefix of the display string is the strongest signal.
  if (hay.startsWith(tokens.join(' '))) total -= 1;
  return total;
}

export function searchCatalog(query: string, limit = 6): CatalogEntry[] {
  const tokens = query.toLowerCase().split(/[^a-z0-9+]+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const ranked: Array<{ e: CatalogEntry; s: number }> = [];
  for (const e of CATALOG_ENTRIES) {
    const s = score(e, tokens);
    if (s !== null) ranked.push({ e, s });
  }
  ranked.sort((a, b) => a.s - b.s
    || (a.e.brand + a.e.name).localeCompare(b.e.brand + b.e.name));
  return ranked.slice(0, limit).map((r) => r.e);
}
