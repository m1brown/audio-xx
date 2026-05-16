/**
 * Stage 14.1b — Comparison source-propagation regression.
 *
 * Locks the contract that brand-vs-brand comparison payloads ship with
 * non-empty, whitelist-aligned sourceReferences whenever either side
 * has authored editorial coverage (EDITORIAL_SOURCES, reviewerQuotes
 * with parenthetical publication, product-level sourceReferences, or
 * an explicit kind='review' brand link).
 *
 * Pre-14.1b bug: buildComparisonStructuredSources pushed brand-profile
 * manufacturer/dealer link labels (e.g. "Official website",
 * "Tone Imports (US importer)") as the `source` field. The renderer's
 * filterSourcesForDisplay (two-tier whitelist) then stripped all of
 * them, leaving the SOURCES heading rendering with no rows beneath.
 *
 * Stage 14.1 already wired the Editorial / Knowledge format renderers
 * — the rendering side is fine. This test validates the data side.
 *
 * Stage 6.2 discipline preserved:
 *   - URL-less Tier 1 entries surface as plain text (no homepage
 *     fallback)
 *   - URL-bearing entries surface with the authored URL
 *   - non-whitelisted publication names are filtered out
 *   - dedupe by source+url
 */

import { describe, it, expect } from 'vitest';

import {
  buildBrandComparison,
  findBrandProfileByName,
} from '../consultation';
import {
  isWhitelistedSource,
  filterSourcesForDisplay,
} from '../evidence/source-whitelist';
import type { BrandProfile } from '../consultation';

// Synthetic fixtures for brands without in-codebase BrandProfiles.
// Mirrors the comparison-consistency test pattern.
const SYNTHETIC_CH_PRECISION = {
  name: 'CH Precision',
  philosophy: 'CH Precision designs reference-level Swiss electronics.',
  tendencies: 'CH Precision components are described as composed, controlled, neutral, and analytical.',
};

const SYNTHETIC_SOULUTION = {
  name: 'Soulution',
  philosophy: 'Soulution builds Swiss reference electronics around extremely wide bandwidth.',
  tendencies: 'Soulution amplifiers are described as transparent, neutral, controlled, and analytical.',
};

interface Pair {
  label: string;
  sideA: () => BrandProfile | { name: string; philosophy: string; tendencies: string } | undefined;
  sideB: () => BrandProfile | { name: string; philosophy: string; tendencies: string } | undefined;
}

// Each repro pair from the Stage 14.1b brief.
const PAIRS: Pair[] = [
  {
    label: 'hegel vs shindo',
    sideA: () => findBrandProfileByName('Hegel'),
    sideB: () => findBrandProfileByName('Shindo'),
  },
  {
    label: 'leben vs hegel',
    sideA: () => findBrandProfileByName('Leben'),
    sideB: () => findBrandProfileByName('Hegel'),
  },
  {
    label: 'first watt vs ch precision',
    sideA: () => findBrandProfileByName('Pass Labs'),
    sideB: () => SYNTHETIC_CH_PRECISION,
  },
  {
    label: 'audio note vs soulution',
    sideA: () => findBrandProfileByName('Audio Note'),
    sideB: () => SYNTHETIC_SOULUTION,
  },
];

describe('Stage 14.1b — comparison source propagation', () => {
  describe('each repro pair ships non-empty, displayable sourceReferences', () => {
    it.each(PAIRS)('$label produces sourceReferences that survive whitelist filtering', ({ sideA, sideB }) => {
      const a = sideA();
      const b = sideB();
      expect(a).toBeDefined();
      expect(b).toBeDefined();

      const response = buildBrandComparison(a!, b!);

      // 1. The advisory-payload-shaped field is populated.
      expect(response.sourceReferences).toBeDefined();
      expect(response.sourceReferences!.length).toBeGreaterThan(0);

      // 2. Every entry is a whitelisted publication — the pre-14.1b
      //    bug pushed non-whitelisted labels ("Official website",
      //    "Tone Imports") which then disappeared at render time,
      //    producing the empty-SOURCES-section regression.
      for (const ref of response.sourceReferences!) {
        expect(
          isWhitelistedSource(ref.source),
          `Non-whitelisted source "${ref.source}" surfaced in comparison payload — would render as empty section.`,
        ).toBe(true);
      }

      // 3. After running through the renderer's two-tier filter, at
      //    least one row survives. This is the actual user-visible
      //    contract.
      const filtered = filterSourcesForDisplay(response.sourceReferences!);
      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  describe('Stage 6.2 discipline preserved', () => {
    it('URL-less Tier 1 entries (EDITORIAL_SOURCES) surface as plain-text references', () => {
      // Hegel has authored EDITORIAL_SOURCES (Stereophile, Darko.Audio,
      // The Audiophiliac) but no kind='review' link with whitelisted label.
      const hegel = findBrandProfileByName('Hegel')!;
      const shindo = findBrandProfileByName('Shindo')!;
      const response = buildBrandComparison(hegel, shindo);

      const refs = response.sourceReferences!;
      // At least one URL-less plain-text entry — coming from
      // EDITORIAL_SOURCES per the Stage 14.1b aggregation.
      const plainText = refs.filter((r) => !r.url);
      expect(plainText.length).toBeGreaterThan(0);
    });

    it('dedupes by source+url pair', () => {
      const hegel = findBrandProfileByName('Hegel')!;
      const shindo = findBrandProfileByName('Shindo')!;
      const response = buildBrandComparison(hegel, shindo);

      const seen = new Set<string>();
      for (const ref of response.sourceReferences!) {
        const key = `${ref.source.toLowerCase()}|${(ref.url ?? '').toLowerCase()}`;
        expect(seen.has(key), `Duplicate source+url combo: ${key}`).toBe(false);
        seen.add(key);
      }
    });

    it('never surfaces a brand-profile manufacturer/dealer link label as the source field', () => {
      // Pre-14.1b would push entries with source="Official website" or
      // source="Tone Imports (US importer)". Stage 14.1b restricts brand-link
      // pushes to kind='review' + whitelisted label only.
      const shindo = findBrandProfileByName('Shindo')!;
      const leben = findBrandProfileByName('Leben')!;
      const response = buildBrandComparison(shindo, leben);

      const sources = response.sourceReferences!.map((r) => r.source.toLowerCase());
      expect(sources).not.toContain('official website');
      expect(sources).not.toContain('tone imports (us importer)');
      expect(sources).not.toContain('tone imports (us distributor)');
    });

    it('caps at 5 entries to keep the SOURCES block scannable', () => {
      const hegel = findBrandProfileByName('Hegel')!;
      const shindo = findBrandProfileByName('Shindo')!;
      const response = buildBrandComparison(hegel, shindo);
      expect(response.sourceReferences!.length).toBeLessThanOrEqual(5);
    });
  });

  describe('reviewerQuotes publication extraction', () => {
    it('extracts whitelisted publication name from "Reviewer (Publication)" pattern', () => {
      // Pass Labs has reviewerQuotes with sources like:
      //   "Herb Reichert (Stereophile)"
      //   "Robert Harley (The Absolute Sound)"
      //   "Srajan Ebaen (6moons)"
      // All three publications are whitelisted.
      const passLabs = findBrandProfileByName('Pass Labs')!;
      const response = buildBrandComparison(passLabs, SYNTHETIC_CH_PRECISION);

      const sources = response.sourceReferences!.map((r) => r.source);
      // At least one of the reviewerQuotes-derived publications surfaces.
      const fromQuotes = sources.filter((s) =>
        ['Stereophile', 'The Absolute Sound', '6moons'].includes(s),
      );
      expect(fromQuotes.length).toBeGreaterThan(0);
    });
  });
});
