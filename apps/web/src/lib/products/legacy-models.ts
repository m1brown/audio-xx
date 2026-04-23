/**
 * Audio XX — Legacy-to-Current Model Mapping
 *
 * Curated list of discontinued/vintage products with known current successors.
 * Used by the selection layer to prefer current models while preserving
 * legacy references for used-market context.
 *
 * Rules:
 *   - Only include mappings where the successor's sonic profile is broadly similar.
 *   - If the successor is materially different in character or price tier, mark
 *     sonicMatch as 'partial' — the system will keep the legacy model with a note
 *     rather than silently substituting.
 *   - 'direct' sonicMatch means safe to substitute with a legacy note.
 *   - 'partial' means keep the legacy model but note the successor exists.
 *   - successorId is the catalog id when the successor IS in the catalog,
 *     or undefined when the successor is known but not yet cataloged.
 */

export interface LegacyMapping {
  /** Catalog id of the discontinued/vintage product. */
  legacyId: string;
  /** Catalog id of the current successor (if present in catalog). */
  successorId?: string;
  /** Display name for the successor (always present, even if not cataloged). */
  successorName: string;
  /** Brand (for display when successor is not cataloged). */
  successorBrand: string;
  /** Product page URL for the successor (when known). */
  successorUrl?: string;
  /** Product image URL for the successor (when known). */
  successorImage?: string;
  /** How closely the successor matches the legacy model's sonic profile. */
  sonicMatch: 'direct' | 'partial';
  /** Short note explaining the relationship. Shown on cards. */
  legacyNote: string;
  /** Short note about the legacy model's used-market relevance. */
  usedNote: string;
}

/**
 * Curated legacy → current mappings.
 * High-impact products only — not a full catalog normalization.
 */
export const LEGACY_MODELS: LegacyMapping[] = [
  // ── Amplifiers ──────────────────────────────────────

  {
    legacyId: 'hegel-h190',
    successorId: undefined,  // H190v not yet in catalog
    successorName: 'H190v',
    successorBrand: 'Hegel',
    successorUrl: 'https://www.hegel.com/en/products/integrated/h190',
    successorImage: 'https://www.hegel.com/images/products/h190v/H190vFront.jpg',
    sonicMatch: 'direct',  // H190v is the current revision of the same line
    legacyNote: 'Current version is the Hegel H190v — same product line, updated revision',
    usedNote: 'Original H190 widely available used and remains a strong integrated at its price point',
  },

  {
    legacyId: 'hegel-rost',
    successorId: undefined,  // No direct successor in catalog
    successorName: 'H95',
    successorBrand: 'Hegel',
    sonicMatch: 'partial',  // H95 is entry-level, different positioning
    legacyNote: 'Hegel Rost replaced by the H95 in Hegel\'s lineup',
    usedNote: 'Rost remains a capable used-market option with Hegel house sound',
  },

  {
    legacyId: 'crayon-cia-1t',
    successorId: undefined,  // CFA-1.2 not in catalog
    successorName: 'CFA-1.2',
    successorBrand: 'Crayon Audio',
    sonicMatch: 'direct',  // Same current-feedback lineage
    legacyNote: 'Succeeded by the Crayon CFA-1.2 — same current-feedback design lineage',
    usedNote: 'CIA-1T still excellent used value for current-feedback character',
  },

  {
    legacyId: 'schiit-aegir',
    successorId: undefined,  // Tyr not in catalog
    successorName: 'Tyr',
    successorBrand: 'Schiit',
    sonicMatch: 'direct',  // Same Continuity circuit evolved
    legacyNote: 'Succeeded by the Schiit Tyr — evolved Continuity™ design',
    usedNote: 'Aegir remains a compelling used-market Class A option',
  },

  {
    legacyId: 'goldmund-job-225',
    successorId: undefined,  // JOB brand discontinued entirely
    successorName: '(brand discontinued)',
    successorBrand: 'Goldmund / JOB',
    sonicMatch: 'partial',
    legacyNote: 'JOB brand discontinued — no direct successor',
    usedNote: 'JOB 225 is a cult classic; strong used-market following',
  },

  // ── Speakers ────────────────────────────────────────

  {
    legacyId: 'harbeth-p3esr',
    successorId: undefined,  // P3ESR XD not yet in catalog
    successorName: 'P3ESR XD',
    successorBrand: 'Harbeth',
    sonicMatch: 'direct',  // XD is a refined evolution, same character
    legacyNote: 'Current version is the P3ESR XD — refined crossover, same BBC heritage character',
    usedNote: 'Original P3ESR widely available used and still a reference for vocal naturalness',
  },

  {
    legacyId: 'harbeth-shl5-plus',
    successorId: undefined,  // SHL5 Plus XD not in catalog
    successorName: 'Super HL5 Plus XD',
    successorBrand: 'Harbeth',
    sonicMatch: 'direct',
    legacyNote: 'Current version is the Super HL5 Plus XD — same house sound, refined crossover',
    usedNote: 'SHL5 Plus widely available used and remains musically excellent',
  },

  {
    legacyId: 'focal-kanta-no2',
    successorId: undefined,  // Kanta No.3 not in catalog
    successorName: 'Kanta No.3',
    successorBrand: 'Focal',
    sonicMatch: 'partial',  // No.3 is a different speaker (3-way floorstander evolved)
    legacyNote: 'Succeeded by the Focal Kanta No.3 — evolved design with updated drivers',
    usedNote: 'Kanta No.2 available used with strong beryllium tweeter performance',
  },

  {
    legacyId: 'amphion-argon3s',
    successorId: undefined,  // Argon3S revision not in catalog
    successorName: 'Argon3S (current revision)',
    successorBrand: 'Amphion',
    sonicMatch: 'direct',
    legacyNote: 'Amphion continues the Argon3S — check for current production revision',
    usedNote: 'Earlier Argon3S revisions available used at good value',
  },

  // ── DACs ────────────────────────────────────────────

  {
    legacyId: 'goldmund-srda',
    successorId: undefined,
    successorName: '(no direct successor)',
    successorBrand: 'Goldmund',
    sonicMatch: 'partial',
    legacyNote: 'Goldmund SRDA DAC discontinued — no direct successor at this price point',
    usedNote: 'SRDA DAC available used; valued for Goldmund house clarity',
  },
];

// ── Lookup helpers ──────────────────────────────────

const _byLegacyId = new Map<string, LegacyMapping>();
for (const m of LEGACY_MODELS) {
  _byLegacyId.set(m.legacyId, m);
}

/**
 * Look up legacy mapping for a product id.
 * Returns undefined if the product is not a known legacy model.
 */
export function getLegacyMapping(productId: string): LegacyMapping | undefined {
  return _byLegacyId.get(productId);
}

/**
 * Returns true if the product has a current successor with a 'direct'
 * sonic match that is present in the catalog — safe to substitute.
 */
export function hasDirectSuccessorInCatalog(productId: string): boolean {
  const m = _byLegacyId.get(productId);
  return !!(m && m.sonicMatch === 'direct' && m.successorId);
}
