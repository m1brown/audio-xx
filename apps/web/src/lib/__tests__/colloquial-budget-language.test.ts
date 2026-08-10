import { describe, it, expect } from 'vitest';
import { parseBudgetAmount, parseBudgetFloor } from '../shopping-intent';
import { detectIntent } from '../intent';

/**
 * Mission 3 — colloquial price-language robustness.
 *
 * Measured 2026-08-10 on the 010f5c3 tree: 9 of 15 colloquial price
 * phrasings failed at the deterministic layer, in two independent ways:
 *
 *   1. parseBudgetAmount missed "two grand", "a grand", "for 2k",
 *      "for 2000" (bare), "no more than N", "about N", "N max", and
 *      dollar-less ranges ("1500 to 2000 range").
 *   2. detectIntent sent budget+category phrasings to audio_knowledge
 *      even when the budget PARSED ("i can spend 2000 on speakers",
 *      "willing to go up to 3k for an amp") — the knowledge lane then
 *      answered with an essay instead of recommendations.
 *
 * The fix layers are the budget regex tables (domain adapter) and one
 * category+parseable-budget shopping gate in detectIntent, placed after
 * every diagnosis gate so complaints keep diagnosis priority.
 */

describe('parseBudgetAmount — colloquial phrasings', () => {
  const cases: Array<[string, number]> = [
    // grand / spelled thousands
    ['speakers for around two grand', 2000],
    ['speakers for under two grand', 2000],
    ['dac for a grand', 1000],
    ['2 grand for speakers', 2000],
    ['speakers, two thousand max', 2000],
    // k-suffix after "for"
    ['speakers for 2k', 2000],
    // bare number after "for"
    ['speakers for 2000', 2000],
    ['speakers for 2,000', 2000],
    // ceiling words
    ['speakers no more than 1200', 1200],
    ['2000 max for speakers', 2000],
    ['about 2500 for an integrated amp', 2500],
    // dollar-less range → upper bound
    ['speakers somewhere in the 1500 to 2000 range', 2000],
    // bucks
    ['800 bucks for a dac', 800],
  ];
  for (const [text, want] of cases) {
    it(`"${text}" → ${want}`, () => {
      expect(parseBudgetAmount(text)).toBe(want);
    });
  }

  it('keeps the previously working phrasings', () => {
    expect(parseBudgetAmount('speakers under $2000')).toBe(2000);
    expect(parseBudgetAmount('speakers for 2000 dollars')).toBe(2000);
    expect(parseBudgetAmount('budget is 1500')).toBe(1500);
    expect(parseBudgetAmount('speakers for $2,000')).toBe(2000);
    expect(parseBudgetAmount('i can spend 2000 on speakers')).toBe(2000);
    expect(parseBudgetAmount('willing to go up to 3k for an amp')).toBe(3000);
    expect(parseBudgetAmount('around 1.5k')).toBe(1500);
  });

  it('floor phrasings still return null as ceiling', () => {
    // "over/above/more than" are floors, not ceilings — parseBudgetFloor territory.
    expect(parseBudgetAmount('speakers over $2000')).toBeNull();
    expect(parseBudgetAmount('amps above 3k')).toBeNull();
    expect(parseBudgetAmount('something more than 1000')).toBeNull();
  });

  it('does not misread non-money numbers', () => {
    // power ranges and spec talk are not budgets
    expect(parseBudgetAmount('10 to 15 watts is enough')).toBeNull();
    expect(parseBudgetAmount('100 to 200 watts of power')).toBeNull();
    expect(parseBudgetAmount('crossover at 2000hz')).toBeNull();
    // "grand piano" is an instrument, not $1000
    expect(parseBudgetAmount('i mostly listen to a grand piano recordings')).toBeNull();
  });
});

describe('parseBudgetFloor — "no more than" is a ceiling, not a floor', () => {
  it('does not read "no more than 1200" as a floor', () => {
    expect(parseBudgetFloor('speakers no more than 1200')).toBeNull();
  });
  it('still reads a genuine floor', () => {
    expect(parseBudgetFloor('speakers over $2000')).toBe(2000);
  });
});

describe('detectIntent — category + parseable budget routes to shopping', () => {
  const shopping = [
    'speakers around 1.5k',
    'i can spend 2000 on speakers',
    'willing to go up to 3k for an amp',
    'speakers, two thousand max',
    'speakers no more than 1200',
    'about 2500 for an integrated amp',
    'speakers somewhere in the 1500 to 2000 range',
    'speakers for around two grand',
    'dac for a grand',
  ];
  for (const p of shopping) {
    it(`"${p}" → shopping`, () => {
      expect(detectIntent(p).intent).toBe('shopping');
    });
  }

  it('complaints keep diagnosis priority even with budget + category', () => {
    expect(detectIntent('my speakers sound harsh').intent).toBe('diagnosis');
    expect(detectIntent('my speakers sound harsh, i can spend 2000 to fix it').intent).toBe('diagnosis');
    expect(detectIntent('my system sounds bright').intent).toBe('diagnosis');
  });

  it('knowledge questions without budgets stay in the knowledge lane', () => {
    expect(detectIntent('what is soundstage?').intent).toBe('audio_knowledge');
    expect(detectIntent('is a streamer upgrade audible').intent).toBe('audio_knowledge');
    expect(detectIntent('Can my Naim Nait 50 drive Falcon LS3/5a speakers?').intent).toBe('audio_knowledge');
  });
});
