/**
 * canonical-names — display-naming hygiene (Stage 12.1).
 *
 * Asserts that brands with non-trivial capitalization (internal capitals,
 * proprietary patterns, multi-word names) resolve to their canonical
 * display form. Locks the documented user-facing examples from the
 * Stage 12.1 brief plus the brands rendered in the 5 audit pairs.
 */

import { describe, it, expect } from 'vitest';

import { toDisplayName, hasCanonicalDisplayName } from '../canonical-names';

describe('canonical-names — toDisplayName', () => {
  describe('Stage 12.1 reported display cases', () => {
    it.each([
      ['pass labs', 'Pass Labs'],
      ['first watt', 'First Watt'],
      ['audio note', 'Audio Note'],
      ['devore', 'DeVore'],
      ['dcs', 'dCS'],
      ['dartzeel', 'darTZeel'],
      ['ch precision', 'CH Precision'],
    ])('maps %s → %s', (input, expected) => {
      expect(toDisplayName(input)).toBe(expected);
    });
  });

  describe('5 audit-pair brands', () => {
    it.each([
      ['shindo', 'Shindo'],
      ['goldmund', 'Goldmund'],
      ['leben', 'Leben'],
      ['hegel', 'Hegel'],
      ['devore fidelity', 'DeVore Fidelity'],
      ['pass labs', 'Pass Labs'],
      ['audio note', 'Audio Note'],
    ])('maps %s → %s', (input, expected) => {
      expect(toDisplayName(input)).toBe(expected);
    });
  });

  describe('case insensitivity + whitespace tolerance', () => {
    it('uppercase input still resolves canonical form', () => {
      expect(toDisplayName('PASS LABS')).toBe('Pass Labs');
      expect(toDisplayName('DCS')).toBe('dCS');
    });
    it('mixed-case input still resolves canonical form', () => {
      expect(toDisplayName('Pass Labs')).toBe('Pass Labs');
      expect(toDisplayName('Audio Note')).toBe('Audio Note');
    });
    it('surrounding whitespace is trimmed', () => {
      expect(toDisplayName('  devore  ')).toBe('DeVore');
    });
  });

  describe('safe fallback for unmapped keys', () => {
    it('returns first-letter-capitalized for unknown brand keys', () => {
      // No canonical entry — falls back to first-letter capitalize.
      // Mirrors the pre-Stage-12.1 behavior so adding a new BrandProfile
      // never regresses rendering until a canonical entry is also added.
      expect(toDisplayName('newbrand')).toBe('Newbrand');
      expect(toDisplayName('some unknown')).toBe('Some unknown');
    });
    it('preserves hyphens / internal punctuation in fallback', () => {
      expect(toDisplayName('foo-bar')).toBe('Foo-bar');
    });
  });

  describe('empty / null / undefined input', () => {
    it.each([
      [null],
      [undefined],
      [''],
      ['   '],
    ])('returns empty string for %s', (input) => {
      expect(toDisplayName(input as never)).toBe('');
    });
  });

  describe('idempotence', () => {
    it('canonical output remains canonical when fed back in', () => {
      // toDisplayName('pass labs') = 'Pass Labs'
      // toDisplayName('Pass Labs') = 'Pass Labs' (case-insensitive lookup)
      // Round-tripping a canonical form must not corrupt it.
      const round1 = toDisplayName('pass labs');
      const round2 = toDisplayName(round1);
      expect(round1).toBe(round2);
      expect(round1).toBe('Pass Labs');
    });
    it('non-canonical fallback is idempotent when re-fed', () => {
      const round1 = toDisplayName('newbrand');
      const round2 = toDisplayName(round1);
      expect(round1).toBe('Newbrand');
      // Round 2: 'Newbrand' lowercased is 'newbrand', no canonical
      // entry, falls back to capitalize → 'Newbrand'.
      expect(round2).toBe('Newbrand');
    });
  });
});

describe('canonical-names — hasCanonicalDisplayName', () => {
  it('returns true for mapped brands', () => {
    expect(hasCanonicalDisplayName('pass labs')).toBe(true);
    expect(hasCanonicalDisplayName('dcs')).toBe(true);
    expect(hasCanonicalDisplayName('devore')).toBe(true);
  });
  it('returns false for unmapped keys', () => {
    expect(hasCanonicalDisplayName('newbrand')).toBe(false);
    expect(hasCanonicalDisplayName(null)).toBe(false);
    expect(hasCanonicalDisplayName('')).toBe(false);
  });
});
