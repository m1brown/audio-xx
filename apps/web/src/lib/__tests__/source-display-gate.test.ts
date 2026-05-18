/**
 * Stage 14.1c — universal empty-Sources gate regression.
 *
 * Locks the contract that no comparison or advisory format renders a
 * "Sources" section header with no rows beneath it. The render-side
 * gate `hasDisplayableSources()` must reject:
 *   - undefined / null / empty source arrays
 *   - arrays containing only non-whitelisted entries
 *   - arrays whose entries would all be stripped by the two-tier filter
 *
 * and must accept:
 *   - arrays with at least one Tier 1 (preferred) entry
 *   - arrays with at least one Tier 2 (acceptable) entry (when no Tier 1)
 *
 * Plus a sanity check on the four pre-14.1b empty-Sources repro pairs
 * (now exercised end-to-end via buildBrandComparison) and the new
 * shindo-vs-hegel ordering — every pair must produce non-empty
 * displayable sources.
 */

import { describe, it, expect } from 'vitest';

import {
  filterSourcesForDisplay,
  hasDisplayableSources,
} from '../evidence/source-whitelist';
import {
  buildBrandComparison,
  findBrandProfileByName,
} from '../consultation';

describe('hasDisplayableSources — universal Sources-section gate', () => {
  describe('rejects (no Sources heading should render)', () => {
    it('undefined input', () => {
      expect(hasDisplayableSources(undefined)).toBe(false);
    });
    it('null input', () => {
      expect(hasDisplayableSources(null)).toBe(false);
    });
    it('empty array', () => {
      expect(hasDisplayableSources([])).toBe(false);
    });
    it('only non-whitelisted entries (manufacturer/dealer link labels)', () => {
      // Pre-14.1b regression — these labels would render as the SOURCES
      // section heading and then disappear inside AdvisorySources.
      expect(
        hasDisplayableSources([
          { source: 'Official website' },
          { source: 'Tone Imports (US importer)' },
          { source: 'Manufacturer page' },
        ]),
      ).toBe(false);
    });
    it('only "SoundStage! Hi-Fi" variant (whitelist has "SoundStage!" not the variant)', () => {
      // Real catalog data — Hegel H390 source list contains
      // "SoundStage! Hi-Fi" which is NOT the whitelisted name.
      expect(
        hasDisplayableSources([{ source: 'SoundStage! Hi-Fi' }]),
      ).toBe(false);
    });
  });

  describe('accepts (Sources heading should render)', () => {
    it('one Tier 1 publication', () => {
      expect(hasDisplayableSources([{ source: '6moons' }])).toBe(true);
    });
    it('one Tier 2 publication (fallback path)', () => {
      expect(hasDisplayableSources([{ source: 'Stereophile' }])).toBe(true);
    });
    it('mixed Tier 1 + non-whitelisted (Tier 1 carries the day)', () => {
      expect(
        hasDisplayableSources([
          { source: 'Darko.Audio' },
          { source: 'Official website' },
        ]),
      ).toBe(true);
    });
  });

  describe('agrees with filterSourcesForDisplay for the same input', () => {
    const cases: Array<{ name: string; refs: { source: string }[] }> = [
      { name: 'empty', refs: [] },
      { name: 'only manufacturer', refs: [{ source: 'Manufacturer' }] },
      { name: 'mixed tier 1 + junk', refs: [{ source: '6moons' }, { source: 'Junk' }] },
      { name: 'tier 2 only', refs: [{ source: 'Stereophile' }, { source: 'Hifi News' }] },
    ];
    it.each(cases)('$name: hasDisplayableSources matches filterSourcesForDisplay.length>0', ({ refs }) => {
      expect(hasDisplayableSources(refs)).toBe(filterSourcesForDisplay(refs).length > 0);
    });
  });

  describe('acts as a TypeScript type guard', () => {
    it('narrows undefined → T[] inside the conditional', () => {
      const maybe: { source: string }[] | undefined = [{ source: '6moons' }];
      if (hasDisplayableSources(maybe)) {
        // Inside this branch, maybe is narrowed to non-undefined.
        // The line below compiles only because of the type guard.
        const _len: number = maybe.length;
        expect(_len).toBe(1);
      } else {
        // Force the branch to be reachable in tests
        expect.fail('should have narrowed');
      }
    });
  });
});

// F4 gate (private beta, 2026-05-18):
//   The "displayable rows exist" assertion below was the inverse of
//   today's contract. Under the F4 reviewer-data exclusion rule,
//   buildBrandComparison must NOT populate sourceReferences — the
//   field is now intentionally undefined for every brand-comparison
//   pair. The block is converted to assert the F4 exclusion explicitly
//   on the same fixture pairs.
describe('F4 — comparison output emits no sourceReferences', () => {
  const PAIRS: Array<[string, string, string]> = [
    ['shindo vs hegel',          'Shindo',    'Hegel'],
    ['hegel vs shindo',          'Hegel',     'Shindo'],
    ['leben vs hegel',           'Leben',     'Hegel'],
    ['hegel vs leben',           'Hegel',     'Leben'],
    ['shindo vs goldmund',       'Shindo',    'Goldmund'],
    ['goldmund vs shindo',       'Goldmund',  'Shindo'],
  ];

  it.each(PAIRS)('%s — comparison output carries no source references', (label, a, b) => {
    const profA = findBrandProfileByName(a);
    const profB = findBrandProfileByName(b);
    expect(profA, `missing fixture: ${a}`).toBeDefined();
    expect(profB, `missing fixture: ${b}`).toBeDefined();

    const response = buildBrandComparison(profA!, profB!, label);
    // F4 hard requirement: reviewer-derived sources must not surface
    // in comparison output. sourceReferences must be undefined; the
    // render-side gate then renders no Sources block.
    expect(response.sourceReferences).toBeUndefined();
    expect(hasDisplayableSources(response.sourceReferences)).toBe(false);
  });
});
