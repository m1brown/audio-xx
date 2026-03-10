/**
 * Knowledge layer loader.
 *
 * Reads approved brand and product profiles from the knowledge directory.
 * Draft entries are NOT loaded at runtime — they exist only for the
 * curation workflow (draft → review → approve → move to approved/).
 *
 * When an approved entry exists, consultation.ts prefers it over the
 * hardcoded BRAND_PROFILES and product catalog data.
 *
 * File convention:
 *   brands/approved/{id}.json  → BrandKnowledge
 *   products/approved/{id}.json → ProductKnowledge
 *
 * Future: if the approved directory grows large, this can be replaced
 * with a build-time compilation step. For now, synchronous JSON imports
 * are fine for the expected scale (dozens of entries, not thousands).
 */

import type { BrandKnowledge, ProductKnowledge } from './schema';

// ── In-memory registries ─────────────────────────────
//
// Populated by registerApprovedBrand / registerApprovedProduct.
// In the current phase, these are populated manually in this file
// as entries are approved. Later, this can be automated with a
// build-time glob of the approved/ directories.

const approvedBrands = new Map<string, BrandKnowledge>();
const approvedProducts = new Map<string, ProductKnowledge>();

// ── Registration helpers ─────────────────────────────

/** Register an approved brand profile. */
export function registerApprovedBrand(brand: BrandKnowledge): void {
  approvedBrands.set(brand.id, brand);
  // Also index by aliases for lookup
  for (const alias of brand.aliases) {
    approvedBrands.set(alias.toLowerCase(), brand);
  }
}

/** Register an approved product profile. */
export function registerApprovedProduct(product: ProductKnowledge): void {
  approvedProducts.set(product.id, product);
}

// ── Public API ───────────────────────────────────────

/**
 * Look up an approved brand profile by ID or alias.
 * Returns undefined if no approved entry exists.
 */
export function getApprovedBrand(idOrAlias: string): BrandKnowledge | undefined {
  return approvedBrands.get(idOrAlias.toLowerCase());
}

/**
 * Look up an approved product profile by ID.
 * Returns undefined if no approved entry exists.
 */
export function getApprovedProduct(id: string): ProductKnowledge | undefined {
  return approvedProducts.get(id.toLowerCase());
}

/**
 * Get all approved brand profiles.
 * Returns unique brands (deduped from alias indexing).
 */
export function getAllApprovedBrands(): BrandKnowledge[] {
  const seen = new Set<string>();
  const result: BrandKnowledge[] = [];
  for (const brand of approvedBrands.values()) {
    if (!seen.has(brand.id)) {
      seen.add(brand.id);
      result.push(brand);
    }
  }
  return result;
}

/**
 * Get all approved product profiles.
 */
export function getAllApprovedProducts(): ProductKnowledge[] {
  return Array.from(approvedProducts.values());
}

/**
 * Get all approved products for a specific brand.
 */
export function getApprovedProductsByBrand(brandId: string): ProductKnowledge[] {
  return Array.from(approvedProducts.values()).filter(
    (p) => p.brandId.toLowerCase() === brandId.toLowerCase(),
  );
}

// ── Approved entry imports ───────────────────────────
//
// As entries are reviewed and approved, move the JSON file from
// draft/ to approved/ and add an import + registration call here.
//
// Example (uncomment when an entry is approved):
//
//   import devore from './brands/approved/devore.json';
//   registerApprovedBrand(devore as BrandKnowledge);
//
//   import devoreO96 from './products/approved/devore-o96.json';
//   registerApprovedProduct(devoreO96 as ProductKnowledge);
//
// No approved entries yet — the draft/ directory contains
// AI-generated profiles awaiting human review.
