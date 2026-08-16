import { describe, it, expect } from 'vitest';
import {
  isCorroborationAcceptable, tierFor, isCacheFresh, identifyingTokens,
  normalizeProductName, POSITIVE_TTL_MS, NEGATIVE_TTL_MS,
} from '../entity-corroboration';

/**
 * The deterministic half of entity corroboration. Control 4 established that
 * the model cannot vouch for its own knowledge — on identical input the
 * fictional "Qwibble Q1" alternated between unknown and confidently
 * characterised. Acceptance is therefore decided here, not by the model.
 */
const official = (over: Record<string, unknown> = {}) => ({
  exists: true, sourceKind: 'official' as const, matchQuality: 0.9,
  sourceUrl: 'https://example.com/p', ...over,
});

describe('a returned URL is not evidence', () => {
  it('rejects when the model claims existence with no source', () => {
    expect(isCorroborationAcceptable('Qwibble Q1', { exists: true, sourceKind: 'official', matchQuality: 1 })).toBe(false);
  });
  it('rejects a retailer or other source in this first implementation', () => {
    expect(isCorroborationAcceptable('Acora QRC-2', official({
      sourceKind: 'retailer', canonicalName: 'Acora QRC-2', sourceUrl: 'https://shop.example.com/acora-qrc-2',
    }))).toBe(false);
  });
  it('rejects a source that names only the brand, not the product', () => {
    expect(isCorroborationAcceptable('Acora QRC-2', official({
      canonicalName: 'Acora Acoustics', sourceUrl: 'https://acoraaudio.com/', sourceTitle: 'Acora Acoustics',
    }))).toBe(false);
  });
  it('rejects below the match-quality floor', () => {
    expect(isCorroborationAcceptable('Acora QRC-2', official({ matchQuality: 0.4, canonicalName: 'Acora QRC-2' }))).toBe(false);
  });
  it('rejects a malformed URL', () => {
    expect(isCorroborationAcceptable('Acora QRC-2', official({ sourceUrl: 'not-a-url', canonicalName: 'Acora QRC-2' }))).toBe(false);
  });
  it('rejects exists:false regardless of everything else', () => {
    expect(isCorroborationAcceptable('Qwibble Q1', official({ exists: false, canonicalName: 'Qwibble Q1' }))).toBe(false);
  });
});

describe('a manufacturer page that names the product is accepted', () => {
  it('accepts a real product with an official source', () => {
    expect(isCorroborationAcceptable('Acora QRC-2', official({
      canonicalName: 'Acora QRC-2', sourceUrl: 'https://acoraaudio.com/qrc-2',
      sourceTitle: 'QRC-2 | Acora Acoustics',
    }))).toBe(true);
  });
  it('accepts when the listener wrote a looser form than the canonical name', () => {
    expect(isCorroborationAcceptable('ARC ref 5', official({
      sourceKind: 'manufacturer', canonicalName: 'Audio Research Reference 5',
      sourceUrl: 'https://audioresearch.com/reference-5', sourceTitle: 'Reference 5 Preamplifier',
    }))).toBe(true);
  });
});

describe('category words carry no identifying weight', () => {
  it('strips them from the token set', () => {
    expect(identifyingTokens('Butler Monad amplifiers')).toEqual(['butler', 'monad']);
    expect(identifyingTokens('the audio speaker system')).toEqual([]);
  });
  it('normalises for cache keying', () => {
    expect(normalizeProductName('  dCS  Rossini APEX!  ')).toBe('dcs rossini apex');
  });
});

describe('tier assignment fails closed', () => {
  it('curated evidence always wins over corroboration', () => {
    expect(tierFor(true, false, 'uncorroborated')).toBe('catalog');
    expect(tierFor(false, true, 'uncorroborated')).toBe('brand');
  });
  it('corroborated but uncatalogued reaches Expanded Reasoning', () => {
    expect(tierFor(false, false, 'corroborated')).toBe('model');
  });
  it('every failure path lands on user-supplied', () => {
    for (const s of ['uncorroborated', 'unavailable', undefined] as const) {
      expect(tierFor(false, false, s)).toBe('user');
    }
  });
});

describe('cache lifetimes', () => {
  const now = 1_800_000_000_000;
  it('positives are long-lived but not permanent', () => {
    expect(isCacheFresh({ normalizedName: 'x', status: 'corroborated', checkedAt: now - 1000 }, now)).toBe(true);
    expect(isCacheFresh({ normalizedName: 'x', status: 'corroborated', checkedAt: now - POSITIVE_TTL_MS - 1 }, now)).toBe(false);
  });
  it('negatives expire much sooner — new gear appears', () => {
    expect(isCacheFresh({ normalizedName: 'x', status: 'uncorroborated', checkedAt: now - NEGATIVE_TTL_MS - 1 }, now)).toBe(false);
  });
  it('an unavailable search is never cached as an answer', () => {
    expect(isCacheFresh({ normalizedName: 'x', status: 'unavailable', checkedAt: now }, now)).toBe(false);
  });
});

describe('a partial match is not a match (live stress-test findings)', () => {
  it('an invented product may not borrow a real product\'s model number', () => {
    // Production, run 4 of 4: "Qwibble Q1" matched a real "Activo x DITA Q1"
    // page. "q1" carried the match while "qwibble" never appeared.
    expect(isCorroborationAcceptable('Qwibble Q1', {
      exists: true, sourceKind: 'manufacturer', matchQuality: 0.8,
      canonicalName: 'Activo x DITA Q1', sourceUrl: 'https://www.activostyle.com/q1',
      sourceTitle: 'Activo x DITA Q1',
    })).toBe(false);
  });

  it('a neighbouring model may not corroborate an invented variant', () => {
    // Production: "dCS Rossini Zenith" matched the real Rossini APEX page.
    // "dcs" and "rossini" matched; "zenith" did not.
    expect(isCorroborationAcceptable('dCS Rossini Zenith', {
      exists: true, sourceKind: 'manufacturer', matchQuality: 0.9,
      canonicalName: 'Rossini APEX', sourceUrl: 'https://dcsaudio.com/product/rossiniapex',
      sourceTitle: 'Rossini APEX',
    })).toBe(false);
  });

  it('the four real controls still corroborate', () => {
    const REAL: Array<[string, Record<string, unknown>]> = [
      ['Acora QRC-2', { canonicalName: 'Acora Acoustics QRC-2', sourceUrl: 'https://www.acoraacoustics.com/qrc-2' }],
      ['Butler MONAD', { canonicalName: 'MONAD A100', brand: 'Butler Audio', sourceUrl: 'https://butleraudio.com/esoteric.php', sourceTitle: 'Butler Audio MONAD' }],
      ['Audio Research Reference 5', { canonicalName: 'Reference 5', sourceUrl: 'https://audioresearch.com/new_website/REF5_Manual.pdf' }],
      ['dCS Rossini Apex', { canonicalName: 'Rossini APEX', sourceUrl: 'https://dcsaudio.com/product/rossiniapex' }],
    ];
    for (const [name, over] of REAL) {
      expect(isCorroborationAcceptable(name, {
        exists: true, sourceKind: 'manufacturer', matchQuality: 0.9, ...over,
      })).toBe(true);
    }
  });
});

describe('the source must be first-party, verified by us not claimed by the model', () => {
  it('rejects a publication even when the model calls it "manufacturer"', () => {
    // Production: "Acora QRC-9" corroborated via ecoustics.com, canonical
    // "QRC-1". The model mislabelled sourceKind AND the digit distinguishing
    // the invented model had been filtered out of the token set.
    expect(isCorroborationAcceptable('Acora QRC-9', {
      exists: true, sourceKind: 'manufacturer', matchQuality: 0.8,
      canonicalName: 'QRC-1',
      sourceUrl: 'https://www.ecoustics.com/news/acora-acoustics-vrc-the-show-2023/',
    })).toBe(false);
  });

  it('rejects an aggregator domain for a real product', () => {
    // Production: a real Acora QRC-2 corroborated via hifiverse.io. The
    // product exists, but that is not first-party evidence of it.
    expect(isCorroborationAcceptable('Acora QRC-2', {
      exists: true, sourceKind: 'manufacturer', matchQuality: 0.9,
      canonicalName: 'Acora Acoustics QRC-2',
      sourceUrl: 'https://www.hifiverse.io/components/loudspeakers/floorstanding/acora-qrc-2',
    })).toBe(false);
  });

  it('the digit in a model designation is identifying', () => {
    expect(identifyingTokens('Acora QRC-9')).toContain('9');
    expect(identifyingTokens('Acora QRC-2')).toContain('2');
  });

  it('first-party manufacturer domains still pass', () => {
    const OK: Array<[string, string, string]> = [
      ['Acora QRC-2', 'Acora Acoustics QRC-2', 'https://www.acoraacoustics.com/qrc-2'],
      ['Butler MONAD', 'Butler MONAD A100', 'https://butleraudio.com/pdf/a100manual.pdf'],
      ['dCS Rossini Apex', 'Rossini APEX', 'https://dcsaudio.com/product/rossiniapex'],
    ];
    for (const [name, canonical, url] of OK) {
      expect(isCorroborationAcceptable(name, {
        exists: true, sourceKind: 'manufacturer', matchQuality: 0.9,
        canonicalName: canonical, sourceUrl: url, sourceTitle: canonical,
      })).toBe(true);
    }
  });
});

describe('a plural is the same identifier, not a different product', () => {
  it("corroborates the listener's plural against the maker's singular", () => {
    // Production: the listener wrote "Butler Monads"; Butler Audio's product
    // is the MONAD. The all-tokens rule rejected a real product over an "s".
    expect(isCorroborationAcceptable('Butler Monads', {
      exists: true, sourceKind: 'manufacturer', matchQuality: 0.9,
      canonicalName: 'MONAD A100', brand: 'Butler Audio',
      sourceUrl: 'https://butleraudio.com/esoteric.php', sourceTitle: 'Butler Audio MONAD',
    })).toBe(true);
  });

  it('does not let morphology rescue an invented product', () => {
    // The frozen negative controls must be unaffected: "qwibble" is no closer
    // to an Activo page with stem tolerance than it was without.
    expect(isCorroborationAcceptable('Qwibble Q1', {
      exists: true, sourceKind: 'manufacturer', matchQuality: 0.9,
      canonicalName: 'Activo x DITA Q1', sourceUrl: 'https://www.activostyle.com/q1',
      sourceTitle: 'Activo x DITA Q1',
    })).toBe(false);
    expect(isCorroborationAcceptable('dCS Rossini Zenith', {
      exists: true, sourceKind: 'manufacturer', matchQuality: 0.9,
      canonicalName: 'Rossini APEX', sourceUrl: 'https://dcsaudio.com/product/rossiniapex',
    })).toBe(false);
  });
});
