/**
 * Catalog figure integrity (launch-blocker P1, 2026-09-03).
 *
 * Two catalog entries stated a product's MODEL NUMBER as its wattage: the
 * JOB 225 ("225W into 8Ω"; the maker's archived page rates it 125W/ch) and
 * the Goldmund Telos 590 NextGen II (225W; published spec is 215W into 8Ω).
 * A wrong consequential figure in authored copy reaches shopping answers
 * directly and contradicts the evidence store — the worst trust class we
 * can ship ourselves.
 *
 * Pins: the two corrected figures, and the generic class — no amplifier
 * whose model name is a bare number may claim that same number as its
 * power_watts, unless listed here with a verified source.
 */
import { describe, it, expect } from 'vitest';
import { AMPLIFIER_PRODUCTS } from '../products/amplifiers';

/** Products whose rated wattage GENUINELY equals their numeric model name,
 *  each requiring a verified source note in the catalog entry. None known. */
const VERIFIED_COINCIDENCES: ReadonlySet<string> = new Set([]);

describe('catalog figure integrity — model numbers are not wattages', () => {
  it('JOB 225 carries the maker rating (125W), never its model number', () => {
    const job = AMPLIFIER_PRODUCTS.find((a) => a.id === 'goldmund-job-225');
    expect(job).toBeTruthy();
    expect(job!.power_watts).toBe(125);
    const prose = `${job!.description ?? ''} ${JSON.stringify(job!.tendencies ?? {})}`;
    expect(prose).not.toMatch(/225\s*W/i);
  });

  it('Telos 590 NextGen II carries the published 215W figure', () => {
    const telos = AMPLIFIER_PRODUCTS.find((a) => a.id === 'goldmund-telos-590');
    expect(telos).toBeTruthy();
    expect(telos!.power_watts).toBe(215);
  });

  it('no amplifier claims its own numeric model name as its wattage', () => {
    for (const a of AMPLIFIER_PRODUCTS) {
      const numericName = /^(\d{2,4})$/.exec((a.name ?? '').trim())?.[1];
      if (!numericName || VERIFIED_COINCIDENCES.has(a.id)) continue;
      expect(a.power_watts, `${a.brand} ${a.name} (${a.id}): power_watts equals the model number — verify or fix`)
        .not.toBe(Number(numericName));
    }
  });
});

import { hasDisplayableSources } from '../evidence/source-whitelist';

describe('6moons exclusion — catalog sweep', () => {
  it('no 6moons sourceReference anywhere in the amplifier catalog is displayable', () => {
    for (const a of AMPLIFIER_PRODUCTS) {
      const refs = (a as { sourceReferences?: Array<{ source?: string }> }).sourceReferences ?? [];
      const sixMoons = refs.filter((r) => /6moons/i.test(r.source ?? ''));
      if (sixMoons.length === 0) continue;
      expect(hasDisplayableSources(sixMoons as never),
        `${a.brand} ${a.name}: 6moons reference must never be displayable`).toBe(false);
    }
  });
});
