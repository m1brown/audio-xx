import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classifySystem } from '../system-class';
import { NATHAN_PRICES, NATHAN_POSITIONS } from '../nathan-market-facts';

const nathan = () => classifySystem(4, NATHAN_PRICES, NATHAN_POSITIONS);

describe('price licenses ambition, never quality', () => {
  it('makes no positive sonic claim', () => {
    /*
     * "sounds" appears once, inside the disclaimer that says the
     * classification is NOT about sound. That sentence is the point of the
     * module, so it is excluded and everything else is checked.
     */
    const src = readFileSync(join(__dirname, '..', 'system-class.ts'), 'utf8');
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      .replace(/not how any of them sounds/g, '')
      .replace(/no conclusion about the sound of this system rests on it/g, '');
    expect(code).not.toMatch(
      /\b(warm|bright|detailed|resolution|musical|smooth|tonal|sonic|sounds?)\b/i);
  });

  it('says outright that the classification carries no sonic conclusion', () => {
    expect(nathan()!.statement).toMatch(/not how any of them sounds/);
  });
});

describe('Nathan, classified from market evidence', () => {
  it('is reference-oriented', () => {
    expect(nathan()!.klass).toBe('reference_oriented');
  });

  it('is NOT called statement-level or price-no-object', () => {
    const s = nathan()!.statement;
    expect(s).not.toMatch(/statement-level system|price-no-object system/);
    expect(nathan()!.withheld).toBeTruthy();
  });

  it('names the higher models that withhold the top rungs', () => {
    expect(nathan()!.withheld).toMatch(/VRC/);
    expect(nathan()!.withheld).toMatch(/Vivaldi/);
  });

  it('names every price and its source', () => {
    for (const p of NATHAN_PRICES) {
      // The first name opens a sentence and is capitalised there.
      expect(nathan()!.statement.toLowerCase()).toContain(p.productName.toLowerCase());
      expect(p.sourceUrl).toMatch(/^https:\/\//);
      expect(p.sourceClass).not.toBe('classified');
    }
  });

  it('admits no classified-ad prices', () => {
    for (const p of NATHAN_PRICES) {
      expect(p.sourceUrl).not.toMatch(/audiogon|usaudiomart|canuckaudiomart|ebay|hifishark/i);
    }
  });
});

describe('it declines rather than guesses', () => {
  it('returns nothing when most of the system is unpriced', () => {
    expect(classifySystem(4, [NATHAN_PRICES[0]])).toBeUndefined();
  });

  it('returns nothing with no prices at all', () => {
    expect(classifySystem(4, [])).toBeUndefined();
  });

  it('uses the median, so one costly box cannot lift the class', () => {
    const cheap = [1500, 1600, 1700].map((usd, i) => ({
      ...NATHAN_PRICES[0], usd, productKey: `k${i}`, productName: `P${i}`,
    }));
    const withOneFlagship = [...cheap, { ...NATHAN_PRICES[0], usd: 90000 }];
    expect(classifySystem(4, withOneFlagship)!.klass).toBe('mid_market');
  });

  it('awards the top rungs only when no higher model is named', () => {
    const dear = [40000, 42000, 45000].map((usd, i) => ({
      ...NATHAN_PRICES[0], usd, productKey: `k${i}`, productName: `P${i}`,
    }));
    expect(classifySystem(3, dear, [])!.withheld).toBeUndefined();
  });
});
