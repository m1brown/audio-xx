/**
 * Product Resolution — Unified lookup chain.
 *
 * Implements the Audio XX resolution order:
 *
 *   1. Validated catalog      (reference provenance)
 *   2. Provisional store      (review_synthesis / review_validated)
 *   3. Brand / family profile (handled downstream, not here)
 *   4. Runtime LLM inference  (handled downstream, not here)
 *
 * This module provides the first two tiers. The consultation engine
 * is responsible for falling through to tiers 3 and 4 when no match
 * is found here.
 *
 * Important: The resolved product carries a provenance tag so the
 * consultation engine knows which trust tier it came from and can
 * frame advisory responses accordingly.
 */

import type { Product } from '../products/dacs';
import type { ProvisionalProduct } from './types';
import type { ProvenanceSourceType, ValidationStatus } from './types';
import { DAC_PRODUCTS } from '../products/dacs';
import { SPEAKER_PRODUCTS } from '../products/speakers';
import { AMPLIFIER_PRODUCTS } from '../products/amplifiers';
import { findProvisionalProductByName, getUsableProvisionalProducts } from './store';

// ── Resolved product ─────────────────────────────────

/**
 * The trust tier of a resolved product.
 *
 *   'catalog'     — validated catalog entry (implicitly reference)
 *   'provisional' — provisional store (review_synthesis or review_validated)
 */
export type ResolutionTier = 'catalog' | 'provisional';

/**
 * Result of product resolution.
 *
 * Wraps either a validated Product or a ProvisionalProduct with
 * metadata about which tier it was resolved from.
 */
export interface ResolvedProduct {
  /** Which store the product was found in. */
  tier: ResolutionTier;

  /** The product data — either a catalog Product or ProvisionalProduct. */
  product: Product | ProvisionalProduct;

  /** Provenance source type for advisory framing. */
  sourceType: ProvenanceSourceType;

  /** Validation status for advisory framing. */
  validationStatus: ValidationStatus;
}

// ── Catalog reference ────────────────────────────────

const ALL_CATALOG_PRODUCTS: Product[] = [
  ...DAC_PRODUCTS,
  ...SPEAKER_PRODUCTS,
  ...AMPLIFIER_PRODUCTS,
];

// ── Resolution functions ─────────────────────────────

/**
 * Resolve a product by name through the full lookup chain.
 *
 * Checks the validated catalog first, then the provisional store.
 * Returns undefined if no match is found in either tier —
 * the caller is responsible for falling through to brand profiles
 * or LLM inference.
 *
 * @param name — Product name, brand+name, or product ID
 */
export function resolveProduct(name: string): ResolvedProduct | undefined {
  const lower = name.toLowerCase().trim();

  // ── Tier 1: Validated catalog ──────────────────────
  const catalogMatch = ALL_CATALOG_PRODUCTS.find((p) => {
    const full = `${p.brand} ${p.name}`.toLowerCase();
    return (
      p.name.toLowerCase() === lower ||
      full === lower ||
      p.id.toLowerCase() === lower
    );
  });

  if (catalogMatch) {
    return {
      tier: 'catalog',
      product: catalogMatch,
      sourceType: 'reference',
      validationStatus: 'validated',
    };
  }

  // ── Tier 2: Provisional store ──────────────────────
  const provisionalMatch = findProvisionalProductByName(name);

  if (provisionalMatch) {
    return {
      tier: 'provisional',
      product: provisionalMatch,
      sourceType: provisionalMatch.provenance.sourceType,
      validationStatus: provisionalMatch.provenance.validationStatus,
    };
  }

  // ── No match — caller falls through to tier 3/4 ───
  return undefined;
}

/**
 * Resolve a product by ID through the full lookup chain.
 */
export function resolveProductById(id: string): ResolvedProduct | undefined {
  const lower = id.toLowerCase();

  const catalogMatch = ALL_CATALOG_PRODUCTS.find(
    (p) => p.id.toLowerCase() === lower,
  );

  if (catalogMatch) {
    return {
      tier: 'catalog',
      product: catalogMatch,
      sourceType: 'reference',
      validationStatus: 'validated',
    };
  }

  const provisionalMatch = getUsableProvisionalProducts().find(
    (p) => p.id.toLowerCase() === lower,
  );

  if (provisionalMatch) {
    return {
      tier: 'provisional',
      product: provisionalMatch,
      sourceType: provisionalMatch.provenance.sourceType,
      validationStatus: provisionalMatch.provenance.validationStatus,
    };
  }

  return undefined;
}

/**
 * Check whether a product name resolves to any tier.
 * Lightweight check — does not return the full product.
 */
export function isKnownProduct(name: string): boolean {
  return resolveProduct(name) !== undefined;
}

/**
 * Get the provenance label for user-facing advisory framing.
 *
 * Maps internal provenance tiers to natural-language labels
 * that can appear in advisory responses.
 *
 *   reference         → (no label — default trust, not called out)
 *   review_synthesis  → "Based on editorial synthesis of review consensus"
 *   review_validated  → "Based on editorially reviewed synthesis"
 *   user_observation  → "Based on community listening observations"
 *   llm_inference     → "Provisional interpretation — not yet reviewed"
 */
export function getProvenanceLabel(sourceType: ProvenanceSourceType): string | undefined {
  switch (sourceType) {
    case 'reference':
      return undefined; // highest trust — no qualifier needed
    case 'review_validated':
      return 'Based on editorially reviewed synthesis';
    case 'review_synthesis':
      return 'Based on editorial synthesis of review consensus';
    case 'user_observation':
      return 'Based on community listening observations';
    case 'llm_inference':
      return 'Provisional interpretation — not yet reviewed';
  }
}
