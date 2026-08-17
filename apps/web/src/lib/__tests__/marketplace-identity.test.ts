import { describe, it, expect } from 'vitest';
import { buildComponentViews, type ComponentSource } from '../system-component-view';

/**
 * Repair 4 — canonical marketplace identity.
 *
 * `searchIdentity` was computed correctly and then discarded: the query was
 * rebuilt by re-splitting the display name with `splitName`, which assumes the
 * brand is exactly one word. That held while identities were listener shorthand
 * and broke as soon as corroboration supplied real manufacturer names.
 * Production queries for the beta system were:
 *
 *   Audio Research Corporation Research Reference 5
 *   Butler Audio (BK Butler) A100
 *   Acora Acoustics Acoustics QRC‑2
 *
 * Three of four dead, and two carried typographic characters (U+2011, U+00A0)
 * that no listing title contains.
 */

const BETA: ComponentSource[] = [
  { displayName: 'dCS Rossini Apex', role: 'dac', roles: ['dac', 'streamer'],
    canonicalName: 'dCS Rossini APEX', canonicalBrand: 'dCS' },
  { displayName: 'ARC ref 5', role: 'preamplifier',
    canonicalName: 'Audio Research Reference 5', canonicalBrand: 'Audio Research Corporation' },
  { displayName: 'Butler Monads', role: 'amplifier',
    canonicalName: 'MONAD A100', canonicalBrand: 'Butler Audio (BK Butler)' },
  { displayName: 'Acora QRC-2', role: 'speaker',
    canonicalName: 'Acora Acoustics QRC‑2', canonicalBrand: 'Acora Acoustics' },
];

const views = buildComponentViews(BETA, undefined);
const query = (v: { hifiSharkUrl?: string }) =>
  decodeURIComponent((v.hifiSharkUrl ?? '').split('q=')[1] ?? '');

describe('the beta system produces four usable searches', () => {
  it.each([
    ['dCS Rossini APEX'],
    ['Audio Research Reference 5'],
    ['Butler Audio MONAD A100'],
    ['Acora Acoustics QRC-2'],
  ])('queries %s', (expected) => {
    expect(views.map(query)).toContain(expected);
  });

  it('never repeats a brand token', () => {
    for (const v of views) {
      const tokens = query(v).toLowerCase().split(/\s+/);
      // "Audio Research Corporation Research Reference 5" — 'research' twice.
      const seen = new Set<string>();
      for (const t of tokens) {
        if (t.length < 3) continue;
        expect(seen.has(t)).toBe(false);
        seen.add(t);
      }
    }
  });

  it('sends no typographic characters a listing title cannot contain', () => {
    for (const v of views) {
      expect(query(v)).not.toMatch(/[ ‐‑‒–—− ]/);
      expect(v.ebayUrl ?? '').not.toMatch(/%C2%A0|%E2%80%91/);
    }
  });

  it('carries no parenthetical asides or corporate suffixes', () => {
    for (const v of views) {
      expect(query(v)).not.toMatch(/[()]/);
      expect(query(v)).not.toMatch(/\b(?:corporation|corp|inc|ltd|llc|gmbh)\b/i);
    }
  });

  it('builds both a HiFiShark and an eBay URL for every component', () => {
    for (const v of views) {
      expect(v.hifiSharkUrl).toMatch(/^https:\/\/www\.hifishark\.com\/search\?q=/);
      expect(v.ebayUrl).toMatch(/^https:\/\/www\.ebay\.com\/sch\//);
    }
  });
});

describe('the listener’s own words are never lost', () => {
  it('keeps listenerName verbatim', () => {
    expect(views.map((v) => v.listenerName))
      .toEqual(['dCS Rossini Apex', 'ARC ref 5', 'Butler Monads', 'Acora QRC-2']);
  });

  it('upgrades the display name only when canonical adds information', () => {
    const byListener = new Map(views.map((v) => [v.listenerName, v.displayName]));
    // Resolves an abbreviation — an upgrade.
    expect(byListener.get('ARC ref 5')).toMatch(/Audio Research Reference.5/);
    // Mere capitalisation — not an upgrade; restyling what someone typed reads
    // as the product correcting them.
    expect(byListener.get('dCS Rossini Apex')).toBe('dCS Rossini Apex');
  });
});

describe('an uncorroborated component still gets a search', () => {
  it('falls back to the listener’s words rather than producing nothing', () => {
    const [v] = buildComponentViews(
      [{ displayName: 'Well Tempered Lab Amadeus', role: 'turntable' }], undefined,
    );
    expect(query(v)).toContain('Amadeus');
  });
});
