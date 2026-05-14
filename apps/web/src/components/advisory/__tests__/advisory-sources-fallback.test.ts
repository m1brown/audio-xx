/**
 * AdvisorySources URL-resolution regression test.
 *
 * Stage 6.2 contract (locks the renderer behavior in AdvisorySources.tsx):
 *
 *   1. SourceReference.url (per-citation deep link, when curated) →
 *      render as a clickable link.
 *   2. No per-citation URL → render as plain text (no homepage
 *      fallback). The bare publication name reading as a clickable
 *      "6moons ↗" link pointing to https://6moons.com/ was a
 *      reviewer-trust UX defect (Stage 6.2 fix).
 *
 * Scope: pure unit tests. Replicates the resolution logic from
 * AdvisorySources.tsx to lock its behavior.
 */

import { describe, it, expect } from 'vitest';

import {
  SOURCE_WHITELIST,
  getSourceEntry,
} from '../../../lib/evidence/source-whitelist';

// ── Resolution function — mirrors AdvisorySources.tsx ──
//
// Kept here as a pure function so tests assert the contract directly.
// If the renderer's resolution changes, mirror it here. The duplication
// IS the contract.

function resolveSourceHref(
  ref: { source: string; url?: string },
): string | undefined {
  return ref.url;
}

// ─────────────────────────────────────────────────────
// Tier 1 — per-citation URL takes precedence
// ─────────────────────────────────────────────────────

describe('resolveSourceHref — per-citation URL', () => {
  it('returns the per-citation URL when present', () => {
    const ref = {
      source: 'Darko.Audio',
      note: 'Specific Hugo TT2 review.',
      url: 'https://darko.audio/2020/01/some-specific-hugo-tt2-review/',
    };
    expect(resolveSourceHref(ref)).toBe(
      'https://darko.audio/2020/01/some-specific-hugo-tt2-review/',
    );
  });

  it('per-citation URL is used verbatim — no homepage substitution', () => {
    const ref = {
      source: 'Darko.Audio',
      note: 'Per-citation deep link.',
      url: 'https://darko.audio/per-citation/',
    };
    expect(resolveSourceHref(ref)).toBe(ref.url);
  });
});

// ─────────────────────────────────────────────────────
// Tier 2 — no per-citation URL → plain text (Stage 6.2)
// ─────────────────────────────────────────────────────

describe('resolveSourceHref — no homepage fallback', () => {
  it('returns undefined for Darko.Audio when no per-citation URL is set', () => {
    // Pre-Stage-6.2 this used to resolve to https://darko.audio/ (the
    // whitelist homepage). That made the rendered "Darko.Audio ↗" chip
    // a homepage link. Stage 6.2 drops the fallback so the renderer
    // can fall through to plain text.
    const ref = {
      source: 'Darko.Audio',
      note: 'Comparison with Qutest and Hugo 2.',
    };
    expect(resolveSourceHref(ref)).toBeUndefined();
  });

  it('returns undefined for Stereophile when no per-citation URL is set', () => {
    const ref = {
      source: 'Stereophile',
      note: 'Review covering Hugo TT2 tap count.',
    };
    expect(resolveSourceHref(ref)).toBeUndefined();
  });

  it('returns undefined for 6moons when no per-citation URL is set', () => {
    const ref = {
      source: '6moons',
      note: 'Review covering tonal authority.',
    };
    expect(resolveSourceHref(ref)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────
// Tier 3 — non-whitelisted sources
// ─────────────────────────────────────────────────────

describe('resolveSourceHref — non-whitelisted sources', () => {
  it('returns undefined for a source not in the whitelist with no URL', () => {
    const ref = {
      source: 'Some Unknown Blog',
      note: 'Random opinion.',
    };
    expect(resolveSourceHref(ref)).toBeUndefined();
  });

  it('keeps the per-citation URL even for non-whitelisted sources', () => {
    // Defensive: even though filterSourcesForDisplay() should strip
    // these before they reach the renderer, the resolution function
    // itself shouldn't drop a real URL just because the source isn't
    // whitelisted.
    const ref = {
      source: 'Some Unknown Blog',
      note: 'Random opinion.',
      url: 'https://some-unknown.example/post/',
    };
    expect(resolveSourceHref(ref)).toBe('https://some-unknown.example/post/');
  });
});

// ─────────────────────────────────────────────────────
// Whitelist invariant — still verified for completeness
// ─────────────────────────────────────────────────────

describe('SOURCE_WHITELIST invariant — every entry has a homepage URL', () => {
  it('every whitelist entry carries a non-empty url', () => {
    expect(SOURCE_WHITELIST.length).toBeGreaterThan(0);
    for (const entry of SOURCE_WHITELIST) {
      expect(entry.url, `whitelist entry "${entry.name}" is missing a url`).toBeTruthy();
      expect(typeof entry.url).toBe('string');
      expect(entry.url!.startsWith('http')).toBe(true);
    }
  });

  it('every whitelist entry resolves through getSourceEntry', () => {
    for (const entry of SOURCE_WHITELIST) {
      const resolved = getSourceEntry(entry.name);
      expect(resolved, `getSourceEntry failed to resolve "${entry.name}"`).toBeDefined();
      expect(resolved!.url).toBe(entry.url);
    }
  });
});
