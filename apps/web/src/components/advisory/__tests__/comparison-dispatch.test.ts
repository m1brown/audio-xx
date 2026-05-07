/**
 * Comparison dispatch regression test.
 *
 * Locks the explicit comparison-selection contract added to the renderer
 * cascade in AdvisoryMessage.tsx. Comparisons must select StandardFormat
 * intentionally — they must never reach it by fallthrough, and they must
 * never be swallowed by a future widening of `isMemoFormat` or any other
 * upstream predicate.
 *
 * Strategy: the new predicate `isComparisonFormat` runs BEFORE
 * `isMemoFormat` in the dispatcher cascade. This test verifies the
 * predicate's behavior directly; the cascade ordering is enforced by
 * code review of the dispatcher block.
 *
 * Scope: pure unit test on the predicate. No renderer.
 */

import { describe, it, expect } from 'vitest';

import { isComparisonFormat } from '../AdvisoryMessage';
import type { AdvisoryResponse } from '@/lib/advisory-response';

// ── Fixtures ──────────────────────────────────────────

function comparisonAdvisory(overrides: Partial<AdvisoryResponse> = {}): AdvisoryResponse {
  return {
    kind: 'consultation',
    advisoryMode: 'gear_comparison',
    subject: 'Chord vs Denafrips',
    comparisonSummary: 'These take different approaches.\n\n**Chord:** FPGA timing.\n\n**Denafrips:** R2R density.',
    comparisonImages: [
      { brand: 'Chord', name: 'Qutest', imageUrl: 'https://example.test/qutest.jpg' },
      { brand: 'Denafrips', name: 'Pontus II', imageUrl: 'https://example.test/pontus.jpg' },
    ],
    ...overrides,
  } as AdvisoryResponse;
}

function nonComparisonAdvisory(overrides: Partial<AdvisoryResponse> = {}): AdvisoryResponse {
  return {
    kind: 'consultation',
    advisoryMode: 'gear_advice',
    subject: 'Chord Qutest',
    philosophy: 'Precision-first FPGA design.',
    ...overrides,
  } as AdvisoryResponse;
}

// ── Tests ─────────────────────────────────────────────

describe('isComparisonFormat — explicit comparison dispatch', () => {
  it('returns true for an advisory with gear_comparison mode AND comparisonSummary', () => {
    const a = comparisonAdvisory();
    expect(isComparisonFormat(a)).toBe(true);
  });

  it('returns false when comparisonSummary is missing (defensive AND)', () => {
    const a = comparisonAdvisory({ comparisonSummary: undefined });
    expect(isComparisonFormat(a)).toBe(false);
  });

  it('returns false when advisoryMode is not gear_comparison (primary key check)', () => {
    const a = comparisonAdvisory({ advisoryMode: 'gear_advice' });
    expect(isComparisonFormat(a)).toBe(false);
  });

  it('returns false for non-comparison gear_advice responses', () => {
    expect(isComparisonFormat(nonComparisonAdvisory())).toBe(false);
  });
});

describe('isComparisonFormat — defensive against memo-trigger field leak', () => {
  // The key regression-protection invariant: a comparison advisory that
  // also carries memo-trigger fields (componentAssessments, upgradePaths)
  // must STILL be classified as a comparison. The predicate must not be
  // overridden by the presence of those fields, because the dispatcher
  // checks isComparisonFormat BEFORE isMemoFormat.

  it('still returns true when componentAssessments is also present', () => {
    const a = comparisonAdvisory({
      componentAssessments: [
        { name: 'Test component', role: 'dac', readingType: 'strength', explanation: 'x' } as never,
      ],
    } as Partial<AdvisoryResponse>);
    expect(isComparisonFormat(a)).toBe(true);
  });

  it('still returns true when upgradePaths is also present', () => {
    const a = comparisonAdvisory({
      upgradePaths: [
        { area: 'DAC', focus: 'precision', options: [] } as never,
      ],
    } as Partial<AdvisoryResponse>);
    expect(isComparisonFormat(a)).toBe(true);
  });

  it('still returns true when systemContext is also present (system_review trigger)', () => {
    const a = comparisonAdvisory({
      systemContext: 'Some system narrative.',
    });
    expect(isComparisonFormat(a)).toBe(true);
  });

  it('still returns true when all three memo-trigger fields are present simultaneously', () => {
    const a = comparisonAdvisory({
      componentAssessments: [
        { name: 'X', role: 'dac', readingType: 'strength', explanation: 'x' } as never,
      ],
      upgradePaths: [
        { area: 'DAC', focus: 'precision', options: [] } as never,
      ],
      systemContext: 'Some system narrative.',
    } as Partial<AdvisoryResponse>);
    expect(isComparisonFormat(a)).toBe(true);
  });
});

describe('isComparisonFormat — covers all canonical comparison flavors', () => {
  it('brand comparison shape', () => {
    const a = comparisonAdvisory({
      subject: 'Chord vs Denafrips',
      sourceReferences: [{ source: 'Darko.Audio', note: 'Review.' }] as never,
    });
    expect(isComparisonFormat(a)).toBe(true);
  });

  it('product comparison shape (with matched products)', () => {
    const a = comparisonAdvisory({
      subject: 'Qutest vs Pontus II',
    });
    expect(isComparisonFormat(a)).toBe(true);
  });

  it('upgrade comparison shape (with structured upgrade fields populated as side effect)', () => {
    const a = comparisonAdvisory({
      subject: 'Hugo → Hugo TT2',
      tendencies: 'Upgrade prose...',
      strengths: ['composure', 'tonal density'],
      limitations: ['cost premium'],
    } as Partial<AdvisoryResponse>);
    expect(isComparisonFormat(a)).toBe(true);
  });

  it('follow-up criterion refinement shape (no sources, no links)', () => {
    const a = comparisonAdvisory({
      subject: 'Chord vs Denafrips — transparency',
      followUp: 'Which model are you considering?',
    });
    expect(isComparisonFormat(a)).toBe(true);
  });

  it('system-relative comparison shape (system anchor in summary)', () => {
    const a = comparisonAdvisory({
      subject: 'Chord vs Denafrips — with Crayon CIA',
      comparisonSummary: 'This is not a neutral comparison.\n\nWith the Crayon...',
    });
    expect(isComparisonFormat(a)).toBe(true);
  });
});
