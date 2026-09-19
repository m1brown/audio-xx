/**
 * Identity admission for exact-product evidence.
 *
 * The image boundary's doctrine, applied to facts:
 *
 *     NO SUFFICIENTLY ESTABLISHED PRODUCT IDENTITY
 *     → NO EXACT-PRODUCT FACT ADMISSION.
 *
 * A raw user string ("ARC ref") may name a component in conversation, hold a
 * place in a saved system, and seed a clarifying question — but it must not
 * license exact-product manufacturer facts merely because a web search found
 * something plausibly related. The REF 330M tube complement rendered on an
 * unresolved "ARC ref" preamplifier card is the incident this module exists
 * to end: string equality of a raw key is NOT identity.
 *
 * "Sufficiently established" reuses the repo's existing identity semantics —
 * nothing new is invented:
 *
 *   catalog       the name resolves to an Audio XX catalog product
 *                 (identity curated by hand);
 *   brand         the name's leading tokens resolve to a curated
 *                 BrandProfile with a model designation following — the
 *                 same anchor the dossier reports as "Audio XX brand
 *                 evidence". Curated-brand components are deliberately
 *                 never corroborated ("we already hold better evidence"),
 *                 so excluding this basis would permanently suppress
 *                 legitimately admitted facts with no self-healing path;
 *   corroborated  the entity-corroboration layer verified this exact
 *                 normalized name against an acceptable source and recorded
 *                 a positive answer (existence does not expire, so the check
 *                 reads positives regardless of freshness — the same rule
 *                 `readAnyPositive` documents);
 *   null          user-description-only, uncorroborated, ambiguous, or
 *                 never-looked-up. The safe finished state is absence.
 *
 * This is computeComponentProvenance's basis lattice (catalog / brand /
 * model / user) with exactly one rule added: `user` never licenses
 * exact-product facts.
 *
 * The gate is consulted at BOTH boundaries (defense in depth):
 *   write-time — /api/manufacturer-facts refuses ACQUISITION for an
 *                unestablished identity, server-side;
 *   read-time  — the durable fact tier suppresses rows whose key's identity
 *                is not currently established, so stale contaminated rows
 *                are inert without deleting anything (the same
 *                retire-on-read pattern the first-party rule uses).
 */
import { findProductByComponentName, findBrandProfileByName } from '../catalog/lookups';
import { readAnyPositive } from '../corroboration-store';
import { productKeyFor } from './manufacturer-facts';

export interface EstablishedIdentity {
  basis: 'catalog' | 'brand' | 'corroborated';
  /** The resolved designation, where the basis records one. */
  canonicalName?: string;
}

/**
 * A curated brand anchoring the name's LEADING tokens, with a model
 * designation following. "Accuphase E-600" → the Accuphase profile;
 * "arc ref" → nothing ("ARC" is not a curated brand alias). A bare brand
 * name with no model tokens is not a product identity.
 */
function leadingBrandProfile(key: string): { brand: string } | null {
  const tokens = key.split(' ').filter(Boolean);
  for (let n = Math.min(3, tokens.length - 1); n >= 1; n--) {
    const candidate = tokens.slice(0, n).join(' ');
    const profile = findBrandProfileByName(candidate);
    if (profile) return { brand: profile.names[0] ?? candidate };
  }
  return null;
}

/**
 * Is this name/key a sufficiently established product identity?
 * Never throws; a store failure is a `null` (absence), not an error.
 */
export async function establishedIdentity(
  nameOrKey: string,
): Promise<EstablishedIdentity | null> {
  const key = productKeyFor(nameOrKey);
  if (!key) return null;

  try {
    const product = findProductByComponentName(nameOrKey)
      ?? findProductByComponentName(key);
    if (product) {
      return {
        basis: 'catalog',
        canonicalName: [product.brand, product.name].filter(Boolean).join(' ') || undefined,
      };
    }
  } catch { /* catalog unavailable → fall through to corroboration */ }

  try {
    const brand = leadingBrandProfile(key);
    if (brand) return { basis: 'brand' };
  } catch { /* catalog unavailable → fall through */ }

  try {
    const positive = await readAnyPositive(key);
    if (positive?.status === 'corroborated') {
      return { basis: 'corroborated', canonicalName: positive.canonicalName };
    }
  } catch { /* store failure is absence */ }

  return null;
}

export async function identityEstablished(nameOrKey: string): Promise<boolean> {
  return (await establishedIdentity(nameOrKey)) !== null;
}
