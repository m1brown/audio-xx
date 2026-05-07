/**
 * Comparison advisory contract regression test.
 *
 * Locks the documentation-as-code contract for what a comparison
 * advisory MUST and MUST NOT carry. The contract is enforced via
 * `assertComparisonContract` (silent on non-comparison advisories;
 * returns violations for comparison advisories that miss required
 * fields or carry forbidden ones).
 *
 * Adapters (consultationToAdvisory, gearResponseToAdvisory) wrap their
 * built advisories with `withComparisonContractCheck`, which logs
 * violations via console.warn but never throws — defensive
 * normalization, not a runtime gate.
 */

import { describe, it, expect } from 'vitest';

import { assertComparisonContract } from '../advisory-response';
import type { AdvisoryResponse } from '../advisory-response';

// ── Fixtures ──────────────────────────────────────────

function cleanComparison(overrides: Partial<AdvisoryResponse> = {}): AdvisoryResponse {
  return {
    kind: 'consultation',
    advisoryMode: 'gear_comparison',
    subject: 'Chord vs Denafrips',
    comparisonSummary: 'These take different approaches.\n\nFPGA timing vs R2R density.',
    comparisonImages: [
      { brand: 'Chord', name: 'Qutest', imageUrl: 'https://example.test/qutest.jpg' },
      { brand: 'Denafrips', name: 'Pontus II', imageUrl: 'https://example.test/pontus.jpg' },
    ],
    ...overrides,
  } as AdvisoryResponse;
}

function nonComparison(overrides: Partial<AdvisoryResponse> = {}): AdvisoryResponse {
  return {
    kind: 'consultation',
    advisoryMode: 'gear_advice',
    subject: 'Chord Qutest',
    philosophy: 'Precision-first FPGA design.',
    ...overrides,
  } as AdvisoryResponse;
}

// ── Tests ─────────────────────────────────────────────

describe('assertComparisonContract — non-comparison advisories', () => {
  it('returns isComparison=false for gear_advice (no warnings)', () => {
    const result = assertComparisonContract(nonComparison());
    expect(result.isComparison).toBe(false);
    expect(result.violations).toEqual([]);
  });

  it('returns isComparison=false for shopping/editorial advisories', () => {
    const a = nonComparison({ advisoryMode: 'gear_advice' });
    const result = assertComparisonContract(a);
    expect(result.isComparison).toBe(false);
    expect(result.violations).toEqual([]);
  });

  it('does NOT flag forbidden fields on non-comparison advisories', () => {
    // philosophy is FORBIDDEN on comparisons, but legitimate on gear_advice.
    // The contract must be silent on non-comparisons regardless of fields.
    const a = nonComparison({
      philosophy: 'Single-product philosophy prose',
      tendencies: 'Single-product tendency prose',
      audioProfile: { profileComplete: false } as never,
    });
    const result = assertComparisonContract(a);
    expect(result.isComparison).toBe(false);
    expect(result.violations).toEqual([]);
  });
});

describe('assertComparisonContract — required fields', () => {
  it('clean comparison passes (no violations)', () => {
    const result = assertComparisonContract(cleanComparison());
    expect(result.isComparison).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('flags missing comparisonSummary', () => {
    const a = cleanComparison({ comparisonSummary: undefined });
    const result = assertComparisonContract(a);
    expect(result.isComparison).toBe(true);
    expect(result.violations).toContain('Missing required field: comparisonSummary');
  });

  it('flags empty-string comparisonSummary', () => {
    const a = cleanComparison({ comparisonSummary: '' });
    const result = assertComparisonContract(a);
    expect(result.violations).toContain('Missing required field: comparisonSummary');
  });
});

describe('assertComparisonContract — forbidden fields', () => {
  it('flags philosophy on a comparison advisory', () => {
    const a = cleanComparison({ philosophy: 'Single-product framing leak' });
    const result = assertComparisonContract(a);
    expect(result.violations).toContain('Forbidden field set: philosophy');
  });

  it('does NOT flag tendencies on a comparison advisory (intentional carve-out for upgrade comparisons)', () => {
    // Upgrade comparisons map `ua.whatChanges` (prose synthesis of the
    // sonic shift) onto `tendencies`, where StandardFormat renders it as
    // the "What the proposed change actually does" section. Removing it
    // would degrade upgrade-comparison output to a stack of bullet lists.
    // General/brand comparisons gate `tendencies: undefined` at the
    // adapter level, so the contract delegates to those adapter gates and
    // stays silent on `tendencies` itself.
    const a = cleanComparison({ tendencies: 'Prose synthesis of the sonic shift' });
    const result = assertComparisonContract(a);
    expect(result.violations).not.toContain('Forbidden field set: tendencies');
  });

  it('flags whyFitsYou on a comparison advisory', () => {
    const a = cleanComparison({ whyFitsYou: ['Some bullet', 'Another bullet'] });
    const result = assertComparisonContract(a);
    expect(result.violations).toContain('Forbidden field set: whyFitsYou');
  });

  it('flags systemFit on a comparison advisory', () => {
    const a = cleanComparison({ systemFit: 'Single-product systemFit prose' });
    const result = assertComparisonContract(a);
    expect(result.violations).toContain('Forbidden field set: systemFit');
  });

  it('flags audioProfile on a comparison advisory', () => {
    const a = cleanComparison({ audioProfile: { profileComplete: true } as never });
    const result = assertComparisonContract(a);
    expect(result.violations).toContain('Forbidden field set: audioProfile');
  });

  it('reports multiple forbidden fields together', () => {
    const a = cleanComparison({
      philosophy: 'leak A',
      systemFit: 'leak C',
      whyFitsYou: ['leak D'],
    });
    const result = assertComparisonContract(a);
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
    expect(result.violations).toContain('Forbidden field set: philosophy');
    expect(result.violations).toContain('Forbidden field set: systemFit');
    expect(result.violations).toContain('Forbidden field set: whyFitsYou');
  });
});

describe('assertComparisonContract — upgrade-comparison shape (tendencies + improvements)', () => {
  it('produces zero violations for a canonical upgrade-comparison advisory', () => {
    // Mirrors the actual shape produced by gearResponseToAdvisory's
    // upgrade branch when r.upgradeAnalysis is present:
    //   - advisoryMode: 'gear_comparison'
    //   - comparisonSummary: r.anchor (architecture-lineage prose)
    //   - tendencies: ua.whatChanges (prose synthesis — renders as
    //     "What the proposed change actually does")
    //   - improvements: ua.improvements (bullet list — renders as
    //     "What improves")
    //   - plus other structured upgrade fields
    const a = cleanComparison({
      tendencies: 'The shift introduces fuller harmonic body while preserving timing precision.',
      strengths: ['composure under load', 'tonal density'],
      limitations: ['cost premium'],
      improvements: ['more body in the lower midrange', 'fuller bass weight'],
      unchanged: ['transient speed'],
    });
    const result = assertComparisonContract(a);
    expect(result.isComparison).toBe(true);
    expect(result.violations).toEqual([]);
  });
});

describe('assertComparisonContract — optional fields are tolerated', () => {
  it('comparisonImages absence is fine', () => {
    const a = cleanComparison({ comparisonImages: undefined });
    expect(assertComparisonContract(a).violations).toEqual([]);
  });

  it('sourceReferences and links absent is fine', () => {
    const a = cleanComparison({ sourceReferences: undefined, links: undefined });
    expect(assertComparisonContract(a).violations).toEqual([]);
  });

  it('all optional fields populated is fine', () => {
    const a = cleanComparison({
      sourceReferences: [{ source: 'Darko.Audio', note: 'review' }] as never,
      links: [{ label: 'Buy', url: 'https://example.test', kind: 'reference' }] as never,
      followUp: 'What are you pairing it with?',
    });
    expect(assertComparisonContract(a).violations).toEqual([]);
  });
});
