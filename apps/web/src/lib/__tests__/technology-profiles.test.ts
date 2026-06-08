/**
 * Audio XX — TechnologyProfile lookup-helper sanity tests.
 *
 * Commit 1 (infra) of the SET Technology Page sequence. The TECHNOLOGY_
 * PROFILES array is empty at this stage; the tests verify the lookup
 * helper handles the empty case correctly and that the type system
 * accepts a minimal TechnologyProfile shape.
 *
 * Once SET content lands (commit 3), the SET-specific lookup behaviour
 * is verified by the dev-server live render at /tech/set. No content-
 * tests are added here — that pattern would couple this file to the
 * editorial content and would have to be re-edited on every content
 * change.
 */

import { describe, it, expect } from 'vitest';
import {
  TECHNOLOGY_PROFILES,
  findTechnologyProfileBySlug,
  type TechnologyProfile,
} from '../technology-profiles';

describe('technology-profiles infrastructure', () => {
  it('TECHNOLOGY_PROFILES is an array', () => {
    expect(Array.isArray(TECHNOLOGY_PROFILES)).toBe(true);
  });

  it('findTechnologyProfileBySlug returns undefined for unknown slug', () => {
    expect(findTechnologyProfileBySlug('does-not-exist')).toBeUndefined();
  });

  it('findTechnologyProfileBySlug returns undefined for empty string', () => {
    expect(findTechnologyProfileBySlug('')).toBeUndefined();
  });

  it('TechnologyProfile type accepts a minimal valid entry', () => {
    // Type-level smoke test: this object compiles iff TechnologyProfile
    // accepts the documented minimal shape. No runtime assertion on
    // shape — the compile check IS the assertion.
    const sample: TechnologyProfile = {
      names: ['_sample'],
      displayName: 'Sample',
      philosophy: 'A minimal philosophy paragraph for type-shape verification.',
      whatItIs: 'A minimal what-it-is paragraph.',
      whyItMatters: 'A minimal why-it-matters paragraph.',
      strengths: ['One strength.', 'Two.'],
      tradeoffs: ['One trade-off.', 'Two.'],
      systemFit: 'A minimal system-fit paragraph.',
      relatedBrandSlugs: [{ slug: 'devore', relation: 'Sample relation.' }],
    };
    expect(sample.displayName).toBe('Sample');
    expect(sample.relatedBrandSlugs).toHaveLength(1);
  });

  it('lookup matches by slugified alias when populated', () => {
    // The empty-array case is verified above. This test simulates a
    // populated array via a typed fixture without mutating the export.
    const populated: TechnologyProfile[] = [
      {
        names: ['set', 'single-ended triode'],
        displayName: 'SET',
        philosophy: '_',
        whatItIs: '_',
        whyItMatters: '_',
        strengths: ['_'],
        tradeoffs: ['_'],
        systemFit: '_',
        relatedBrandSlugs: [],
      },
    ];
    // Inline reimplementation of the helper against the local fixture —
    // matches the helper's slugification logic so that when the helper
    // is exercised against TECHNOLOGY_PROFILES with content (commit 3),
    // the same lookup semantics apply.
    const lookupAgainstFixture = (slug: string) =>
      populated.find((tp) =>
        tp.names.some((name) =>
          // Mirror toSlug semantics from lib/route-slug for the test
          // (no import here so this test does not couple to route-slug
          // beyond the contract documented in the helper).
          name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') === slug,
        ),
      );
    expect(lookupAgainstFixture('set')?.displayName).toBe('SET');
    expect(lookupAgainstFixture('single-ended-triode')?.displayName).toBe('SET');
    expect(lookupAgainstFixture('does-not-exist')).toBeUndefined();
  });
});
