/**
 * Evidence retrieval for the governed reasoning lane (build item 1).
 *
 * Read-only over the same stores the product already trusts: held
 * manufacturer facts, authored product facts, admitted review observations,
 * and the catalog. Retrieval never acquires, never invents, and never
 * promotes: family stays family, reported stays reported, a maker claim
 * stays a maker claim. Price and tier are supplied as DISTINCT evidence
 * types — context for proportionality, never a proxy for quality.
 */
import { readFacts } from '@/lib/evidence/manufacturer-fact-store';
import { isMakerPublished, productKeyFor } from '@/lib/evidence/manufacturer-facts';
import { seedObservationsFor, PRODUCT_IDENTITIES } from '@/lib/evidence/independent-review-seed';
import { FRANCE_FACTS } from '@/lib/evidence/france-product-facts';
import { NATHAN_FACTS } from '@/lib/evidence/nathan-product-facts';
import { findProductByComponentName } from '@/lib/consultation';
import type { ComponentEvidence, EvidenceItem, IdentityResolution } from './governed-context';
import type { DetectedCandidate } from './candidate-detection';

const norm = (s: string) => s.toLowerCase().replace(/[^\w\s/-]/g, ' ').replace(/\s+/g, ' ').trim();

/** Resolve a display name to the governed observation key, alias-safe. */
export function observationKeyFor(displayName: string): string {
  const key = norm(displayName);
  for (const id of PRODUCT_IDENTITIES) {
    if (id.excludes.includes(key)) continue;
    const pool = [id.productKey, id.canonical.toLowerCase(), ...id.aliases.map((a) => a.toLowerCase())];
    if (pool.includes(key) || pool.includes(key.replace(/s\b/, ''))) return id.productKey;
  }
  return key;
}

function authoredItemsFor(key: string): EvidenceItem[] {
  return [...FRANCE_FACTS, ...NATHAN_FACTS]
    .filter((f) => f.productKey === key)
    .map((f) => ({
      class: (f.sourceClass === 'third_party_reported' ? 'third_party_reported' : 'maker_published') as EvidenceItem['class'],
      text: `${f.predicate}: ${f.value}`,
      qualifier: f.qualifier,
      sourceUrl: f.sourceUrl,
    }));
}

/**
 * Everything the application holds for one product identity, classed.
 * `now` travels in so results are reproducible in tests.
 */
export async function retrieveEvidenceFor(
  displayName: string,
  opts: {
    role?: string;
    resolution?: IdentityResolution;
    identityNote?: string;
    catalogBrand?: string;
    catalogName?: string;
    now?: number;
  } = {},
): Promise<ComponentEvidence> {
  const items: EvidenceItem[] = [];
  const storeKey = productKeyFor(displayName);
  const obsKey = observationKeyFor(displayName);

  // Catalog identity — price and tier as distinct evidence types.
  const p = (findProductByComponentName as unknown as (n: string) => Record<string, unknown> | null)(displayName);
  const catalogNamed = !!(p && opts.resolution === 'exact');
  if (p && catalogNamed) {
    const brand = String(p.brand ?? '');
    const name = String(p.name ?? '');
    items.push({ class: 'catalog', text: `catalog identity: ${brand} ${name}${p.category ? ` (${p.category})` : ''}` });
    if (p.architecture) items.push({ class: 'catalog', text: `architecture (catalog record): ${p.architecture}` });
    if (typeof p.price === 'number') {
      items.push({ class: 'catalog', text: `current known retail price (catalog record): $${p.price}` });
    }
    const used = p.usedPriceRange as { low?: number; high?: number } | undefined;
    if (used?.low && used?.high) {
      items.push({ class: 'catalog', text: `used-market observation (catalog record): roughly $${used.low}–$${used.high}` });
    }
    if (p.priceTier) items.push({ class: 'catalog', text: `broad market tier (catalog placement): ${p.priceTier}` });
  }

  // Held manufacturer facts (store) — classified per source at read time.
  for (const f of await readFacts(storeKey, opts.now ?? Date.now())) {
    const att = (f as { attribution?: { sourceUrl?: string; quotedText?: string } }).attribution;
    items.push({
      class: att?.sourceUrl && isMakerPublished(att.sourceUrl, displayName)
        ? 'maker_published' : 'third_party_reported',
      text: `${(f as { field?: string }).field}: ${(f as { value?: string }).value}`,
      sourceUrl: att?.sourceUrl,
    });
  }

  // Authored product facts (curated, provenance-carrying).
  items.push(...authoredItemsFor(obsKey));

  // Admitted independent listening observations, condition attached.
  for (const o of seedObservationsFor(obsKey)) {
    const oo = o as { publication?: string; claim?: string; condition?: { description?: string } };
    if (!oo.claim) continue;
    items.push({
      class: 'independent_listening',
      text: oo.claim,
      publication: oo.publication,
      condition: oo.condition?.description,
    });
  }

  /*
   * Identity upgrade rule: a name the CATALOG cannot place may still be a
   * registered identity in the evidence stores (the store's productKey is
   * itself a governed registration). Holding evidence under the exact typed
   * key establishes the identity; holding nothing changes nothing.
   */
  let identity: IdentityResolution = opts.resolution ?? 'exact';
  if (identity === 'unknown' && items.length > 0) identity = 'exact';

  return {
    displayName,
    role: opts.role,
    identity,
    identityNote: identity === 'exact' ? undefined : opts.identityNote,
    items,
  };
}

/** Retrieval for a detected candidate, preserving its identity discipline. */
export async function retrieveCandidateEvidence(
  c: DetectedCandidate,
  opts: { role?: string; now?: number } = {},
): Promise<ComponentEvidence> {
  /*
   * An AMBIGUOUS candidate retrieves nothing: attaching any product's
   * evidence would be the silent substitution the discipline forbids. The
   * ambiguity itself is what the model must see.
   */
  if (c.resolution === 'ambiguous') {
    return {
      displayName: c.displayName, role: opts.role,
      identity: 'ambiguous', identityNote: c.identityNote, items: [],
    };
  }
  return retrieveEvidenceFor(c.displayName, {
    role: opts.role, resolution: c.resolution, identityNote: c.identityNote, now: opts.now,
  });
}
