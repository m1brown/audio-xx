/**
 * Glossary export-integrity tests.
 *
 * Locks Phase 1 contracts:
 *   - GLOSSARY is exported and iterable
 *   - every entry carries a structured `category` field
 *   - GLOSSARY_CATEGORIES covers every category used by an entry
 *   - slugifyTerm produces stable, URL-safe anchor strings
 *
 * Scope: pure unit tests on the data + helper. No renderer.
 */

import { describe, it, expect } from 'vitest';
import {
  GLOSSARY,
  GLOSSARY_CATEGORIES,
  slugifyTerm,
  type GlossaryCategory,
} from '../glossary';

describe('slugifyTerm', () => {
  it('lowercases single-word terms', () => {
    expect(slugifyTerm('air')).toBe('air');
    expect(slugifyTerm('FPGA')).toBe('fpga');
    expect(slugifyTerm('R2R')).toBe('r2r');
  });

  it('replaces internal whitespace with hyphens', () => {
    expect(slugifyTerm('transient attack')).toBe('transient-attack');
    expect(slugifyTerm('listening fatigue')).toBe('listening-fatigue');
  });

  it('preserves existing hyphens', () => {
    expect(slugifyTerm('delta-sigma')).toBe('delta-sigma');
    expect(slugifyTerm('single-ended triode')).toBe('single-ended-triode');
  });

  it('strips punctuation other than hyphens', () => {
    expect(slugifyTerm('What is air?')).toBe('what-is-air');
    expect(slugifyTerm('PRaT (pace, rhythm, timing)')).toBe('prat-pace-rhythm-timing');
  });

  it('collapses repeated separators and trims edges', () => {
    expect(slugifyTerm('  spaced   out  ')).toBe('spaced-out');
    expect(slugifyTerm('--leading-trailing--')).toBe('leading-trailing');
  });

  it('produces stable slugs for every glossary term (no collisions)', () => {
    const slugs = GLOSSARY.map((e) => slugifyTerm(e.term));
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
    // Every slug is non-empty and url-safe
    for (const s of slugs) {
      expect(s.length).toBeGreaterThan(0);
      expect(s).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe('GLOSSARY export integrity', () => {
  it('is exported as a non-empty array', () => {
    expect(Array.isArray(GLOSSARY)).toBe(true);
    expect(GLOSSARY.length).toBeGreaterThan(0);
  });

  it('every entry has term, aliases, category, and explanation', () => {
    for (const entry of GLOSSARY) {
      expect(typeof entry.term).toBe('string');
      expect(entry.term.length).toBeGreaterThan(0);
      expect(Array.isArray(entry.aliases)).toBe(true);
      expect(typeof entry.category).toBe('string');
      expect(typeof entry.explanation).toBe('string');
      expect(entry.explanation.length).toBeGreaterThan(0);
    }
  });

  it('every entry category appears in GLOSSARY_CATEGORIES', () => {
    const known = new Set<GlossaryCategory>(
      GLOSSARY_CATEGORIES.map((c) => c.id),
    );
    for (const entry of GLOSSARY) {
      expect(known.has(entry.category)).toBe(true);
    }
  });

  it('GLOSSARY_CATEGORIES has no duplicate ids', () => {
    const ids = GLOSSARY_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every category in GLOSSARY_CATEGORIES has at least one entry', () => {
    for (const cat of GLOSSARY_CATEGORIES) {
      const matched = GLOSSARY.filter((e) => e.category === cat.id);
      expect(matched.length).toBeGreaterThan(0);
    }
  });

  it('term values are unique (no duplicate canonical terms)', () => {
    const terms = GLOSSARY.map((e) => e.term);
    expect(new Set(terms).size).toBe(terms.length);
  });
});
