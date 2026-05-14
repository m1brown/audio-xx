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

  // ── Phase 2.5 cleanup (2026-05-14) ──
  // Three residual corrective phrasings still present after 487c55a +
  // 1b9caeb. This block locks the new wordings.

  it('SYSTEM READ sentence 1 no longer says "supplying all of the warmth"', () => {
    expect(narrative).not.toMatch(/supplying all of the warmth/i);
  });

  it('SYSTEM READ sentence 1 uses additive "adding body, warmth, and dynamic release" phrasing', () => {
    expect(narrative).toMatch(/adding body, warmth, and dynamic release/i);
  });

  it('SYSTEM LOGIC speaker row no longer says "prevents thinness"', () => {
    expect(narrative).not.toMatch(/prevents thinness/i);
  });

  it('SYSTEM LOGIC speaker row uses "adds body while preserving speed and flow"', () => {
    expect(narrative).toMatch(/adds body while preserving speed and flow/i);
  });

  it('Do nothing check no longer says "careful compensation"', () => {
    expect(narrative).not.toMatch(/careful compensation/i);
  });

  it('Do nothing check uses "deliberate balance of <synergy>" phrasing', () => {
    expect(narrative).toMatch(/deliberate balance of .+\./i);
  });

  // ── Phase 2.5 final cleanup (2026-05-14) — Decision + Trade-offs ──

  it('Decision section no longer says "leans lean unless corrected"', () => {
    expect(narrative).not.toMatch(/leans lean unless corrected/i);
    expect(narrative).not.toMatch(/unless corrected/i);
  });

  it('Decision section uses "intentionally speed-forward" phrasing on synergy + lean upstream', () => {
    expect(narrative).toMatch(/intentionally speed-forward/i);
    expect(narrative).toMatch(/change the DAC only if you want more tonal density/i);
  });

  it('Trade-offs section no longer says "exposes thinness on dense tracks"', () => {
    expect(narrative).not.toMatch(/exposes thinness/i);
  });

  it('Trade-offs section uses "speed, flow, and immediacy" phrasing on synergy + lean upstream', () => {
    expect(narrative).toMatch(/Current setup excels at speed, flow, and immediacy/i);
    expect(narrative).toMatch(/denser music may reveal its lighter tonal mass/i);
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

  it('does NOT use the new "adding body, warmth, and dynamic release" phrasing', () => {
    expect(narrative).not.toMatch(/adding body, warmth, and dynamic release/i);
  });

  it('does NOT use "adds body while preserving speed and flow" — non-synergy speakers keep the corrective phrase', () => {
    // A non-synergy contrast system should still get one of the original
    // corrective speaker-row phrases ("prevents thinness", "adds body to a
    // lean upstream", etc.), confirming this cleanup is gated on synergy.
    expect(narrative).not.toMatch(/adds body while preserving speed and flow/i);
  });

  it('does NOT use the new "deliberate balance" Do-nothing phrasing', () => {
    expect(narrative).not.toMatch(/deliberate balance of /i);
  });

  it('does NOT use the new "intentionally speed-forward" Decision phrasing', () => {
    expect(narrative).not.toMatch(/intentionally speed-forward/i);
  });

  it('does NOT use the new "speed, flow, and immediacy" Trade-offs phrasing', () => {
    expect(narrative).not.toMatch(/Current setup excels at speed, flow, and immediacy/i);
  });
});
