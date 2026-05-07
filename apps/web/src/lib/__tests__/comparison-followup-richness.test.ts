/**
 * Comparison follow-up richness regression test.
 *
 * Locks the carry-forward contract for sourceReferences and links across
 * comparison refinement turns. The originating turn populates these
 * fields; the refinement builders inherit them via state.activeComparison
 * so criterion follow-ups and system-relative refinements remain as rich
 * as the parent comparison.
 *
 * Scope: pure unit tests on the two refinement builders. No renderer.
 */

import { describe, it, expect } from 'vitest';

import {
  buildComparisonRefinement,
  buildContextRefinement,
} from '../consultation';
import type { SubjectMatch } from '../intent';
import type { AdvisoryLink, SourceReference } from '../advisory-response';

// ── Fixtures ──────────────────────────────────────────

const SUBJECT_A: SubjectMatch = {
  name: 'chord',
  kind: 'brand',
} as SubjectMatch;

const SUBJECT_B: SubjectMatch = {
  name: 'denafrips',
  kind: 'brand',
} as SubjectMatch;

const SOURCES: SourceReference[] = [
  { source: 'Darko.Audio', note: 'Review covering FPGA timing.', url: 'https://darko.audio/qutest' },
  { source: 'HiFi News', note: 'R2R ladder review.', url: 'https://hifinews.example/pontus' },
];

const LINKS: AdvisoryLink[] = [
  { label: 'Chord Qutest review', url: 'https://example.test/chord-review', kind: 'review' },
  { label: 'Buy Chord Qutest', url: 'https://example.test/chord-buy', kind: 'reference' },
];

function activeComparisonWithRichness() {
  return {
    left: SUBJECT_A,
    right: SUBJECT_B,
    scope: 'brand' as const,
    sourceReferences: SOURCES,
    links: LINKS,
  };
}

function activeComparisonBare() {
  return {
    left: SUBJECT_A,
    right: SUBJECT_B,
    scope: 'brand' as const,
  };
}

// ── Tests — buildComparisonRefinement (criterion follow-up) ──

describe('buildComparisonRefinement — carry-forward of sources/links', () => {
  it('inherits sourceReferences from active comparison', () => {
    const result = buildComparisonRefinement(
      activeComparisonWithRichness(),
      'which is more transparent?',
    );
    expect(result.sourceReferences).toBeDefined();
    expect(result.sourceReferences).toEqual(SOURCES);
  });

  it('inherits links from active comparison', () => {
    const result = buildComparisonRefinement(
      activeComparisonWithRichness(),
      'which has more flow?',
    );
    expect(result.links).toBeDefined();
    expect(result.links).toEqual(LINKS);
  });

  it('still produces comparisonSummary and comparisonImages alongside the carry-forward', () => {
    const result = buildComparisonRefinement(
      activeComparisonWithRichness(),
      'which is more transparent?',
    );
    expect(result.comparisonSummary).toBeDefined();
    expect(result.comparisonSummary!.length).toBeGreaterThan(0);
    expect(result.comparisonImages).toBeDefined();
  });

  it('returns undefined for sources/links when active comparison has none (graceful degrade)', () => {
    const result = buildComparisonRefinement(
      activeComparisonBare(),
      'which has more flow?',
    );
    expect(result.sourceReferences).toBeUndefined();
    expect(result.links).toBeUndefined();
    // Refinement still produces a valid response — degradation, not failure.
    expect(result.comparisonSummary).toBeDefined();
  });
});

// ── Tests — buildContextRefinement (system-relative follow-up) ──

describe('buildContextRefinement — carry-forward of sources/links', () => {
  it('inherits sourceReferences from active comparison', () => {
    const result = buildContextRefinement(
      activeComparisonWithRichness(),
      'my amp is a Crayon CIA',
      'amplifier',
    );
    expect(result.sourceReferences).toBeDefined();
    expect(result.sourceReferences).toEqual(SOURCES);
  });

  it('inherits links from active comparison', () => {
    const result = buildContextRefinement(
      activeComparisonWithRichness(),
      'my speakers are DeVore O/96',
      'speaker',
    );
    expect(result.links).toBeDefined();
    expect(result.links).toEqual(LINKS);
  });

  it('still produces comparisonSummary and comparisonImages alongside the carry-forward', () => {
    const result = buildContextRefinement(
      activeComparisonWithRichness(),
      'my amp is a Crayon CIA',
      'amplifier',
    );
    expect(result.comparisonSummary).toBeDefined();
    expect(result.comparisonSummary!.length).toBeGreaterThan(0);
    expect(result.comparisonImages).toBeDefined();
  });

  it('returns undefined for sources/links when active comparison has none', () => {
    const result = buildContextRefinement(
      activeComparisonBare(),
      'my amp is a Crayon CIA',
      'amplifier',
    );
    expect(result.sourceReferences).toBeUndefined();
    expect(result.links).toBeUndefined();
    expect(result.comparisonSummary).toBeDefined();
  });
});
