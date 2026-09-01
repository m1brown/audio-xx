import { describe, it, expect } from 'vitest';
import { readPowerFigures, comparable, pairAcrossLoads } from '../quantity-compatibility';

/**
 * EVIDENCE COMPATIBILITY IS PART OF LICENSING.
 *
 * Two numbers describing what looks like the same property may have been
 * measured under conditions that make arithmetic between them meaningless —
 * and the wrong answer looks entirely reasonable, which is what makes this
 * class of defect dangerous rather than merely wrong.
 *
 * The Butler string is the worked example that forced the rule:
 *
 *   "Minimum 100 Watts RMS @ 8 Ohms; 128 Watts, RMS typical @ 8 Ohms;
 *    200 Watts, RMS typical @ 4 Ohms"
 *
 * First-match takes the MINIMUM at 8 and the TYPICAL at 4 and reports the
 * amplifier doubling its power. Like-for-like it rises about 1.6x.
 */

const BUTLER = 'Minimum 100 Watts RMS @ 8 Ohms; 128 Watts, RMS typical @ 8 Ohms; 200 Watts, RMS typical @ 4 Ohms';

describe('conditions are read, never assumed', () => {
  it('reads every figure with its own conditions', () => {
    const f = readPowerFigures(BUTLER);
    expect(f).toHaveLength(3);
    expect(f[0]).toMatchObject({ value: 100, ohms: 8, status: 'minimum', basis: 'rms' });
    expect(f[1]).toMatchObject({ value: 128, ohms: 8, status: 'typical', basis: 'rms' });
    expect(f[2]).toMatchObject({ value: 200, ohms: 4, status: 'typical', basis: 'rms' });
  });

  it('an unstated condition stays unstated — never defaulted', () => {
    // Defaulting to "typical" would be an assumption about a measurement
    // nobody made, which is exactly the failure this module prevents.
    const [f] = readPowerFigures('50 Watts @ 8 Ohms');
    expect(f.status).toBe('unstated');
    expect(f.basis).toBe('unstated');
  });
});

describe('a comparison is refused unless every material condition matches', () => {
  const [min8, typ8, typ4] = readPowerFigures(BUTLER);

  it('refuses minimum against typical — the trap', () => {
    const r = comparable(min8, typ4);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/different measurement status/);
  });

  it('permits typical against typical', () => {
    expect(comparable(typ8, typ4).ok).toBe(true);
  });

  it('refuses continuous against peak', () => {
    const [rms] = readPowerFigures('100 Watts RMS @ 8 Ohms');
    const [peak] = readPowerFigures('100 Watts peak @ 8 Ohms');
    const r = comparable(rms, peak);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/different measurement (basis|status)/);
  });

  it('refuses stated against unstated — "typical" and "unknown" are not one measurement', () => {
    const [stated] = readPowerFigures('128 Watts, RMS typical @ 8 Ohms');
    const [unstated] = readPowerFigures('200 Watts @ 4 Ohms');
    expect(comparable(stated, unstated).ok).toBe(false);
  });
});

describe('pairing across loads picks the like-for-like pair', () => {
  it('picks typical@8 against typical@4, not minimum@8', () => {
    const p = pairAcrossLoads(readPowerFigures(BUTLER), 4, 8);
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.high.value).toBe(128);
      expect(p.low.value).toBe(200);
      // 200/128 = 1.5625 — NOT the 2.0 the first-match bug reported.
      expect(p.low.value / p.high.value).toBeCloseTo(1.56, 1);
    }
  });

  it('refuses with a STATED reason when no comparable pair exists', () => {
    // A reason is an observability signal: "incompatible evidence conditions"
    // is actionable where "insufficient evidence" is not.
    const p = pairAcrossLoads(readPowerFigures('Minimum 100 Watts @ 8 Ohms; 200 Watts typical @ 4 Ohms'), 4, 8);
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.reason).toMatch(/different measurement status/);
  });

  it('refuses when a load is simply not published', () => {
    const p = pairAcrossLoads(readPowerFigures('200 Watts typical @ 4 Ohms'), 4, 8);
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.reason).toMatch(/no published figure at both/);
  });
});

describe('the rule is architectural, not a fix at one call site', () => {
  it('the review composer routes its arithmetic through the guard', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('apps/web/src/lib/artifact/system-review.ts', 'utf8');
    // Any scaling comparison must pass through pairAcrossLoads first.
    expect(src).toMatch(/pairAcrossLoads\(/);
    // And a refusal must be recorded rather than silently skipped.
    expect(src).toMatch(/unresolved\.push/);
  });
});
