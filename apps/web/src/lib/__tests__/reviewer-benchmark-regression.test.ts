// @ts-nocheck — vitest globals injected via apps/web vitest config

/**
 * Reviewer Demonstration Benchmark — regression-tier CI gate.
 *
 * For each tier-regression case in the benchmark manifest, this file:
 *   1. Resolves the chain through extractSubjectMatches + detectIntent.
 *   2. Calls buildSystemAssessment with the resolved subjects.
 *   3. If resolutionExpectation === 'assessment':
 *        - asserts the assessment kind is 'assessment'
 *        - asserts every `mustContain` marker is present in the narrative
 *        - asserts every `mustNotContain` marker is absent
 *        - asserts every `minSections` header is present
 *      If resolutionExpectation === 'uncatalogued-skip':
 *        - asserts the result is null OR not 'assessment' kind
 *        - confirms graceful degradation (no invented prose)
 *
 * Phase A scope: 4 regression-tier cases.
 *   - my-system               (resolutionExpectation: assessment)
 *   - leben-devore            (resolutionExpectation: assessment)
 *   - audio-note-coherent     (resolutionExpectation: uncatalogued-skip)
 *   - modern-precision-control(resolutionExpectation: assessment)
 *
 * The Playwright runner (reviewer-benchmark.spec.ts) drives all cases
 * end-to-end through the chat UI and captures evidence; this vitest
 * file is the CI gate that runs on every commit.
 */

import { describe, it, expect } from 'vitest';
import { detectIntent, extractSubjectMatches } from '../intent';
import { buildSystemAssessment } from '../consultation';
import {
  regressionCases,
  type BenchmarkCase,
} from '../../tests/reviewer-benchmark-cases';

function runCase(c: BenchmarkCase) {
  const text = c.prompts.primary;
  const subjectMatches = extractSubjectMatches(text);
  const { desires } = detectIntent(text);
  const result = buildSystemAssessment(text, subjectMatches, null, desires);
  return { text, subjectMatches, result };
}

for (const c of regressionCases()) {
  describe(`benchmark: ${c.id} — ${c.systemName}`, () => {
    if (c.resolutionExpectation === 'uncatalogued-skip') {
      it('gracefully skips (uncatalogued products) without inventing assessment', () => {
        const { result } = runCase(c);
        // Acceptable: result is null OR result.kind !== 'assessment'.
        if (result === null) {
          expect(result).toBeNull();
        } else {
          expect(result.kind).not.toBe('assessment');
        }
      });
      return;
    }

    // resolutionExpectation === 'assessment'
    const { text, subjectMatches, result } = runCase(c);
    const narrative = result?.kind === 'assessment'
      ? (result.response?.systemContext ?? '')
      : '';

    it('resolves the chain to a non-empty assessment', () => {
      expect(result).not.toBeNull();
      expect(result!.kind).toBe('assessment');
      expect(narrative.length).toBeGreaterThan(0);
    });

    it('subject matches resolve at least the canonical components', () => {
      // Loose check — at least one subject must resolve. The full chain
      // is verified by the marker assertions below.
      expect(subjectMatches.length).toBeGreaterThanOrEqual(1);
    });

    if (c.expectedMarkers.mustContain.length > 0) {
      it.each(c.expectedMarkers.mustContain)('contains marker: %s', (marker) => {
        expect(narrative.toLowerCase()).toContain(marker.toLowerCase());
      });
    }

    if (c.expectedMarkers.mustNotContain.length > 0) {
      it.each(c.expectedMarkers.mustNotContain)('does NOT contain marker: %s', (marker) => {
        expect(narrative.toLowerCase()).not.toContain(marker.toLowerCase());
      });
    }

    if (c.expectedMarkers.minSections && c.expectedMarkers.minSections.length > 0) {
      it.each(c.expectedMarkers.minSections)('renders section header: %s', (header) => {
        // Headers in the narrative are markdown bold (**Header**).
        // Match case-insensitively, allowing whitespace variation.
        const re = new RegExp(`\\*\\*${header}\\*\\*`, 'i');
        expect(narrative).toMatch(re);
      });
    }
  });
}
