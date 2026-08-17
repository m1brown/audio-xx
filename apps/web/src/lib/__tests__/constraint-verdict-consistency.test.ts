import { describe, it, expect } from 'vitest';
import { buildSystemAssessment } from '../consultation';
import { extractSubjectMatches } from '../intent';

/**
 * Repair 3 — Evaluate may not contradict a licensed Explain constraint.
 *
 * Production, on the promoted D-12 build, said both of these things about the
 * same system, four lines apart:
 *
 *   "The Zorblax ZX1 5 watt SET at 5W has limited headroom for the Magnepan
 *    LRS+ at 86 dB sensitivity (estimated ~93 dB maximum clean output)."
 *
 *   "Primary leverage — None — no obvious bottleneck ... CHANGE only as a
 *    matter of taste — nothing needs correcting."
 *
 * The evidence was never missing. `assessPowerMatch` produced it, the System
 * read printed it, and `detectPrimaryConstraint` built a licensed candidate
 * from it — but that candidate fed the memo-format field while the prose
 * renderer computed its own `primary` from axis scoring alone. Two constraint
 * models, one of them blind to physics.
 *
 * The control below matters as much as the defect: a coherent, adequately
 * powered system must keep its confident no-change. Hedging everywhere would
 * pass this file and break the product.
 */

function context(text: string): string {
  const r = buildSystemAssessment(
    text, extractSubjectMatches(text), undefined, undefined, undefined,
  ) as { response?: { systemContext?: string } };
  return r?.response?.systemContext ?? '';
}

const NO_CHANGE = /no obvious bottleneck|nothing needs correcting|No single component demands change/i;

describe('a licensed power constraint reaches the verdict', () => {
  // 5W into 86 dB ⇒ ~93 dB max clean output ⇒ 'strained'.
  const out = context('Assess my system: Amp: Zorblax ZX1 5 watt SET '
    + 'Speakers: Magnepan LRS+ Dac: Denafrips Pontus II');

  it('still states the constraint in the system read', () => {
    expect(out).toMatch(/limited headroom|underpowered/i);
    expect(out).toMatch(/86 dB/);
  });

  it('names the amplifier as the primary leverage', () => {
    expect(out).toMatch(/\*\*Primary leverage\*\*\s*\n\s*\n\s*The amp/i);
  });

  it('does NOT also report that nothing needs changing', () => {
    expect(out).not.toMatch(NO_CHANGE);
  });

  it('does not frame the constraint as a matter of taste', () => {
    const decision = out.match(/\*\*Decision\*\*[\s\S]*?(?=\n\*\*|$)/)?.[0] ?? '';
    expect(decision).toMatch(/headroom limit rather than a matter of taste/i);
  });

  it('keeps the do-nothing option honest rather than deleting it', () => {
    // Restraint survives — stated as an accepted ceiling, not as an absence
    // of any problem.
    const dn = out.match(/\*\*Do nothing check\*\*[\s\S]*?(?=\n\*\*|$)/)?.[0] ?? '';
    expect(dn).toMatch(/ceiling on dynamics|modest levels/i);
    expect(dn).not.toMatch(/If the system sounds right, it is right/i);
  });
});

describe('CONTROL — adequate power keeps its confident no-change', () => {
  // Leben CS600X ~32W into Klipsch Cornwall IV (high sensitivity).
  const out = context('Assess my system: Amp: Leben CS600 Speakers: Klipsch Cornwall IV '
    + 'Dac: Denafrips Pontus II');

  it('reports no bottleneck', () => {
    expect(out).toMatch(NO_CHANGE);
  });

  it('does not invent a headroom constraint', () => {
    expect(out).not.toMatch(/limited headroom|underpowered|headroom limit/i);
  });

  it('keeps the ordinary do-nothing framing', () => {
    expect(out).toMatch(/\*\*Do nothing check\*\*/);
    expect(out).not.toMatch(/ceiling on dynamics/i);
  });
});

describe('CONTROL — the constraint is not manufactured from missing data', () => {
  it('says nothing about headroom when no power figure exists', () => {
    // Neither side supplies watts, so `classifyPowerMatch` returns 'unknown',
    // which must behave like silence rather than like a finding.
    const out = context('Assess my system: Amp: Leben CS600 Speakers: Harbeth Compact 7ES-3 '
      + 'Dac: Audio Note DAC 2.1x');
    expect(out).not.toMatch(/headroom limit|significantly underpowered/i);
  });
});
