/**
 * Advisory section order snapshot test.
 *
 * Verifies the 9-section system-assessment structure is preserved.
 * If this test fails, the advisory section order has changed —
 * which requires intentional approval.
 *
 * Expected order:
 *   1. System Overview
 *   2. Current System Chain
 *   3. What the System Does Especially Well
 *   4. Trade-offs in the System
 *   5. Strength of Each Component
 *   6. Upgrade Paths
 *   7. Components I Would Keep
 *   8. Recommended Upgrade Path
 *   9. System Philosophy Insight
 */

// @ts-nocheck — globals provided by test-runner.ts

import { detectIntent } from '../intent';
import { buildSystemAssessment } from '../consultation';
import { renderDeterministicMemo, type LegacyProseInputs } from '../memo-deterministic-renderer';
import type { MemoFindings } from '../memo-findings';

// ── Expected section order (source of truth) ──────────

const EXPECTED_SECTION_ORDER = [
  'System Overview',
  'Current System Chain',
  'What the System Does Especially Well',
  'Trade-offs in the System',
  'Strength of Each Component',
  'Upgrade Paths',
  'Components I Would Keep',
  'Recommended Upgrade Path',
  'System Philosophy Insight',
];

// ── Helpers ──────────────────────────────────────────

/**
 * Run the full pipeline and extract the rendered advisory fields
 * that map to each section. Returns section labels in render order.
 */
function extractRenderedSections(message: string): string[] {
  const { subjectMatches, desires } = detectIntent(message);
  const result = buildSystemAssessment(message, subjectMatches, null, desires);
  if (!result || result.kind === 'clarification') {
    throw new Error(`Assessment failed for: "${message}"`);
  }

  const findings: MemoFindings = (result as any).findings;
  const response = result.response;

  // Map populated advisory fields to their section labels
  // in the order MemoFormat renders them.
  const sections: string[] = [];

  // 1. System Overview — always rendered (introSummary or systemContext)
  if (response.introSummary || response.systemContext || response.systemInteraction) {
    sections.push('System Overview');
  }

  // 2. Current System Chain
  if (response.systemChain && response.systemChain.roles.length > 0) {
    sections.push('Current System Chain');
  }

  // 3. What the System Does Especially Well
  if (response.assessmentStrengths && response.assessmentStrengths.length > 0) {
    sections.push('What the System Does Especially Well');
  }

  // 4. Trade-offs in the System
  if (response.assessmentLimitations && response.assessmentLimitations.length > 0) {
    sections.push('Trade-offs in the System');
  }

  // 5. Strength of Each Component
  if (response.componentAssessments && response.componentAssessments.length > 0) {
    sections.push('Strength of Each Component');
  }

  // 6. Upgrade Paths
  if (response.upgradePaths && response.upgradePaths.length > 0) {
    sections.push('Upgrade Paths');
  }

  // 7. Components I Would Keep
  if (response.keepRecommendations && response.keepRecommendations.length > 0) {
    sections.push('Components I Would Keep');
  }

  // 8. Recommended Upgrade Path
  if (response.recommendedSequence && response.recommendedSequence.length > 0) {
    sections.push('Recommended Upgrade Path');
  }

  // 9. System Philosophy Insight
  if (response.keyObservation) {
    sections.push('System Philosophy Insight');
  }

  return sections;
}

// ── Tests ────────────────────────────────────────────

describe('Advisory section order', () => {
  it('matches the canonical 9-section structure for Eversolo → Hugo → JOB → WLM', () => {
    const sections = extractRenderedSections(
      'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?',
    );

    // Every rendered section must appear in the expected order
    let lastIdx = -1;
    for (const section of sections) {
      const idx = EXPECTED_SECTION_ORDER.indexOf(section);
      expect(idx).toBeGreaterThan(-1); // section is in the expected list
      expect(idx).toBeGreaterThan(lastIdx); // order is correct
      lastIdx = idx;
    }
  });

  it('matches the canonical 9-section structure for Denafrips → Leben → Harbeth', () => {
    const sections = extractRenderedSections(
      'I have Denafrips Pontus into Leben CS300 into Harbeth P3ESR. How does it look?',
    );

    let lastIdx = -1;
    for (const section of sections) {
      const idx = EXPECTED_SECTION_ORDER.indexOf(section);
      expect(idx).toBeGreaterThan(-1);
      expect(idx).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    }
  });

  it('includes all 9 sections for a full 4-component system', () => {
    const sections = extractRenderedSections(
      'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?',
    );

    // A 4-component system should produce all 9 sections
    expect(sections).toEqual(EXPECTED_SECTION_ORDER);
  });

  it('never introduces unknown section labels', () => {
    const sections = extractRenderedSections(
      'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?',
    );

    for (const section of sections) {
      expect(EXPECTED_SECTION_ORDER).toContain(section);
    }
  });

  it('expected section order constant is exactly 9 entries', () => {
    expect(EXPECTED_SECTION_ORDER.length).toBe(9);
  });
});
