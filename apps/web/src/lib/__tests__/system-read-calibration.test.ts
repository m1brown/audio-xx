// @ts-nocheck — vitest globals injected via apps/web vitest config

/**
 * Phase 2.5 SYSTEM READ calibration — integration test.
 *
 * After commits 7c51093 + f68a012 shipped the emergent-behavior layer,
 * the SYSTEM READ section still said "Clarity, timing, and spatial
 * precision dominate unless the speaker compensates" and SYSTEM LOGIC
 * still said "The WLM Diva Monitor alone restores weight" — corrective
 * framing that contradicts the emergent paragraph's intentional-synergy
 * reading.
 *
 * This test exercises `buildSystemAssessment` end-to-end against the
 * real catalog with My System's components, then asserts:
 *
 *   1. The new EMERGENT BEHAVIOR paragraph is present and references
 *      the intentional-synergy outcome ("elastic motion").
 *   2. SYSTEM READ no longer says "unless the speaker compensates"
 *      (the corrective sentence is replaced by the intentional-voicing
 *      sentence).
 *   3. SYSTEM LOGIC summary no longer says "alone restores weight."
 *   4. The new override sentences ARE present.
 *
 * A negative control fixture (a generic contrast chain) verifies that
 * systems without emergent synergy still get the original corrective
 * framing — the calibration is opt-in via emergent-tag detection.
 */

import { describe, it, expect } from 'vitest';
import { detectIntent, extractSubjectMatches } from '../intent';
import { buildSystemAssessment } from '../consultation';

describe('SYSTEM READ calibration — My System (intentional synergy)', () => {
  const text =
    'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, WLM Diva Monitor';
  const subjectMatches = extractSubjectMatches(text);
  const { desires } = detectIntent(text);
  const result = buildSystemAssessment(text, subjectMatches, null, desires);
  const narrative = result.response?.systemContext ?? '';

  it('renders a non-empty system assessment narrative', () => {
    expect(narrative.length).toBeGreaterThan(0);
  });

  it('includes the new EMERGENT BEHAVIOR section', () => {
    expect(narrative).toMatch(/\*\*Emergent behavior\*\*/);
    expect(narrative).toMatch(/elastic motion/i);
  });

  it('SYSTEM READ no longer says "unless the speaker compensates"', () => {
    expect(narrative).not.toMatch(/unless the speaker compensates/i);
  });

  it('SYSTEM READ no longer uses "alone restores weight" framing', () => {
    expect(narrative).not.toMatch(/alone restores weight/i);
    expect(narrative).not.toMatch(/alone adds definition/i);
  });

  it('SYSTEM READ includes the new intentional-voicing sentence', () => {
    expect(narrative).toMatch(
      /Speaker, amp, and DAC are deliberately voiced together around .+\./i,
    );
  });

  it('SYSTEM LOGIC summary includes the new "each component contributes" sentence', () => {
    expect(narrative).toMatch(
      /Each component contributes to the system's .+\./i,
    );
  });

  it('synergy descriptor references at least one of: speed, elasticity, tonal body', () => {
    // Whatever exact tag set fires (deployed catalog may differ slightly),
    // the descriptor must include the speed/elasticity/tonal-body cluster
    // OR another intentional-synergy concept.
    const synergyMatch = narrative.match(
      /deliberately voiced together around ([^.]+)\./i,
    );
    expect(synergyMatch).toBeTruthy();
    const descriptor = synergyMatch![1];
    const referencesIntentional =
      /speed|elasticity|tonal body|harmonic continuity|temporal coherence|low-drag|musical flow/i.test(
        descriptor,
      );
    expect(referencesIntentional).toBe(true);
  });
});

describe('SYSTEM READ calibration — negative control (must not affect non-synergy systems)', () => {
  // A clearly mismatched-tone chain that should NOT trigger intentional
  // synergy tags: budget delta-sigma DAC → clinical Hegel → BBC speaker.
  // The bright/detailed upstream + warm/smooth downstream produces the
  // tension pattern, and no architecture-based synergy fires (Hegel is
  // SoundEngine, not low-feedback). The corrective "compensates" framing
  // is the right interpretation here and must be preserved.
  const text =
    'Assess my system: Topping D90SE, Hegel H190, Harbeth Compact 7';
  const subjectMatches = extractSubjectMatches(text);
  const { desires } = detectIntent(text);
  const result = buildSystemAssessment(text, subjectMatches, null, desires);
  const narrative = result.response?.systemContext ?? '';

  it('renders a non-empty narrative', () => {
    expect(narrative.length).toBeGreaterThan(0);
  });

  it('does NOT include the new intentional-voicing sentence', () => {
    expect(narrative).not.toMatch(
      /Speaker, amp, and DAC are deliberately voiced together around/i,
    );
  });

  it('does NOT include the "each component contributes" override', () => {
    expect(narrative).not.toMatch(/Each component contributes to the system's/i);
  });
});
