/**
 * AdvisorySources URL-resolution regression test.
 *
 * Locks the renderer-side fallback contract added in AdvisorySources.tsx:
 *
 *   1. SourceReference.url (per-citation deep link, when curated)
 *   2. SOURCE_WHITELIST entry's homepage url (publication landing page)
 *   3. Plain text — non-link span — when neither is available
 *
 * The previous behavior rendered URL-less sources as plain spans, which
 * made upgrade-comparison source attributions read as prose rather than
 * clickable links. The whitelist already curates a homepage URL for
 * every approved publication, so the second tier nearly always
 * resolves.
 *
 * Scope: pure unit tests. Replicates the resolution logic from
 * AdvisorySources.tsx to lock its behavior, and verifies the whitelist
 * invariant (every approved source carries a homepage URL) the
 * fallback depends on.
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
  return ref.url ?? getSourceEntry(ref.source)?.url;
}

// ─────────────────────────────────────────────────────
// Tier 1 — per-citation URL takes precedence
// ─────────────────────────────────────────────────────

describe('resolveSourceHref — per-citation URL precedence', () => {
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

  it('per-citation URL beats whitelist homepage even when both exist', () => {
    // The whitelist has https://darko.audio/ as Darko.Audio's homepage.
    // The per-citation URL must still win.
    const ref = {
      source: 'Darko.Audio',
      note: 'Per-citation deep link.',
      url: 'https://darko.audio/per-citation/',
    };
    const homepage = getSourceEntry('Darko.Audio')?.url;
    expect(homepage).toBeDefined();
    expect(homepage).not.toBe(ref.url);
    expect(resolveSourceHref(ref)).toBe(ref.url);
  });
});

// ─────────────────────────────────────────────────────
// Tier 2 — whitelist homepage fallback (the regression fix)
// ─────────────────────────────────────────────────────

describe('resolveSourceHref — whitelist homepage fallback', () => {
  it('falls back to the whitelist homepage URL when no per-citation URL exists', () => {
    // The exact regression case: Hugo TT2's Darko.Audio source has no
    // per-citation URL in dacs.ts, so the renderer used to produce a
    // plain <span>. With the fallback, it now resolves to the
    // whitelist homepage.
    const ref = {
      source: 'Darko.Audio',
      note: 'Comparison with Qutest and Hugo 2 covering upgrade path reasoning.',
      // url is intentionally absent
    };
    expect(resolveSourceHref(ref)).toBe('https://darko.audio/');
  });

  it('falls back for Stereophile (Tier 2 publication)', () => {
    const ref = {
      source: 'Stereophile',
      note: 'Review covering Hugo TT2 tap count.',
    };
    expect(resolveSourceHref(ref)).toBe('https://www.stereophile.com/');
  });

  it('falls back for 6moons (Tier 1 publication)', () => {
    const ref = {
      source: '6moons',
      note: 'Review covering tonal authority.',
    };
    expect(resolveSourceHref(ref)).toBe('https://6moons.com/');
  });
});

// ─────────────────────────────────────────────────────
// Tier 3 — non-whitelisted sources
// ─────────────────────────────────────────────────────

describe('resolveSourceHref — non-whitelisted sources', () => {
  it('returns undefined for a source not in the whitelist', () => {
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
// Whitelist invariant — the fallback's enabling guarantee
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
