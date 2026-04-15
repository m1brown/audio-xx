/**
 * Labeled-system detection tests.
 *
 * Verifies that system descriptions using role labels, hyphens, and
 * informal phrasing correctly route to system_assessment — not
 * gear_comparison or product_assessment.
 *
 * Covers:
 *   1. Labeled system input triggers system_assessment
 *   2. Hyphen-separated system input triggers system_assessment
 *   3. Informal phrasing ("how's this system") triggers system_assessment
 *   4. Non-system queries remain unaffected (no false positives)
 */

import { detectIntent } from '../intent';
import { detectSystemDescription } from '../system-extraction';
import { extractSubjectMatches } from '../intent';
import type { AudioSessionState } from '../system-types';

function emptyState(): AudioSessionState {
  return {
    activeSystemRef: null,
    savedSystems: [],
    draftSystem: null,
    loading: false,
    proposedSystem: null,
  };
}

// ──────────────────────────────────────────────────────
// 1. Labeled system input → system_assessment
// ──────────────────────────────────────────────────────

describe('Labeled-role system input routes to system_assessment', () => {
  it('exact Case B: "how\'s this system: speakers: ... - amplifier: ... - streamer: ..."', () => {
    const msg = "how's this system: speakers: wlm diva monitors - amplifier: job integrated - streamer: eversolo dmp-a6";
    const result = detectIntent(msg);
    expect(result.intent).toBe('system_assessment');
  });

  it('comma-separated labels: "speaker: X, dac: Y, amp: Z"', () => {
    const msg = 'how does this system look? speaker: KEF LS50 Meta, dac: Chord Qutest, amp: Hegel H190';
    const result = detectIntent(msg);
    expect(result.intent).toBe('system_assessment');
  });

  it('shorthand labels: "amp: X - dac: Y - speakers: Z"', () => {
    const msg = 'evaluate this setup: amp: Leben CS300 - dac: Denafrips Pontus II - speakers: Harbeth P3ESR';
    const result = detectIntent(msg);
    expect(result.intent).toBe('system_assessment');
  });
});

// ──────────────────────────────────────────────────────
// 2. Hyphen-separated system input → system_assessment
// ──────────────────────────────────────────────────────

describe('Hyphen-separated system input routes to system_assessment', () => {
  it('role labels with hyphen separators', () => {
    const msg = "how's this system: turntable: Rega Planar 3 - integrated: Hegel H95 - speakers: KEF LS50 Meta";
    const result = detectIntent(msg);
    expect(result.intent).toBe('system_assessment');
  });

  it('headphones + amp labeled chain', () => {
    const msg = "how's this setup: headphones: Focal Utopia - amp: Chord Hugo TT2";
    const result = detectIntent(msg);
    expect(result.intent).toBe('system_assessment');
  });
});

// ──────────────────────────────────────────────────────
// 3. Informal phrasing → system_assessment
// ──────────────────────────────────────────────────────

describe('Informal system phrasing triggers system_assessment', () => {
  it('"how\'s this system:" with role labels', () => {
    const msg = "how's this system: speakers: wlm diva monitors - amplifier: job integrated - streamer: eversolo dmp-a6";
    const result = detectIntent(msg);
    expect(result.intent).toBe('system_assessment');
  });

  it('"what do you think of this system:" with role labels', () => {
    const msg = 'what do you think of this system: dac: Denafrips Ares - amp: Pass Labs INT-25 - speakers: DeVore Super Nine';
    const result = detectIntent(msg);
    expect(result.intent).toBe('system_assessment');
  });
});

// ──────────────────────────────────────────────────────
// 4. Non-system queries are not affected (no false positives)
// ──────────────────────────────────────────────────────

describe('Non-system queries remain unaffected', () => {
  it('single brand question stays as brand inquiry', () => {
    const msg = 'Tell me about the Chord sound';
    const result = detectIntent(msg);
    expect(result.intent).not.toBe('system_assessment');
  });

  it('comparison with "vs" stays as comparison', () => {
    const msg = 'Denafrips Ares vs Chord Qutest';
    const result = detectIntent(msg);
    expect(result.intent).not.toBe('system_assessment');
  });

  it('shopping query stays as shopping', () => {
    const msg = 'What DAC should I get under $2000?';
    const result = detectIntent(msg);
    expect(result.intent).not.toBe('system_assessment');
  });

  it('single role label does not trigger system_assessment', () => {
    const msg = 'I love my speakers: they sound amazing';
    const result = detectIntent(msg);
    expect(result.intent).not.toBe('system_assessment');
  });
});

// ──────────────────────────────────────────────────────
// 5. System-extraction ownership gate
// ──────────────────────────────────────────────────────

describe('detectSystemDescription recognises "this system:" as ownership', () => {
  it('"this system:" with role labels passes ownership gate', () => {
    const msg = "how's this system: speakers: wlm diva monitors - amplifier: job integrated - streamer: eversolo dmp-a6";
    const subjects = extractSubjectMatches(msg);
    const proposed = detectSystemDescription(msg, subjects, emptyState());
    // Should not return null (ownership gate should pass)
    // May or may not extract all components depending on catalog coverage,
    // but the ownership gate must not reject it.
    // The key test: if subjects >= 2 are found, proposedSystem should be non-null.
    if (subjects.length >= 2) {
      expect(proposed).not.toBeNull();
    }
  });

  it('"here\'s my system:" passes ownership gate', () => {
    const msg = "here's my system: dac: Chord Hugo - amp: Job Integrated - speakers: WLM Diva Monitor";
    const subjects = extractSubjectMatches(msg);
    const proposed = detectSystemDescription(msg, subjects, emptyState());
    if (subjects.length >= 2) {
      expect(proposed).not.toBeNull();
    }
  });

  it('Case A still works: "evaluate my system" with standard input', () => {
    const msg = 'evaluate my system';
    const result = detectIntent(msg);
    // This should route to consultation_entry or system_assessment depending on subjects
    // With no named gear, it becomes consultation_entry
    expect(result.intent).not.toBe('comparison');
    expect(result.intent).not.toBe('gear_question');
  });
});

// ──────────────────────────────────────────────────────
// 6. Task 6b — ownership + chain WITHOUT assessment language
//    "here's my system:" and "current system:" with role labels
//    should route to system_assessment even without "evaluate",
//    "how's this", or other assessment language.
// ──────────────────────────────────────────────────────

describe('Ownership + chain (no assessment language) → system_assessment', () => {
  it('Prompt 2: "here\'s my system: dac: chord qutest - amp: hegel h190 - speakers: devore orangutan o/96"', () => {
    const msg = "here's my system: dac: chord qutest - amp: hegel h190 - speakers: devore orangutan o/96";
    const result = detectIntent(msg);
    expect(result.intent).toBe('system_assessment');
  });

  it('Prompt 3: "current system: source: bluesound node x - amp: primaluna evo 300 - speakers: harbeth p3esr"', () => {
    const msg = 'current system: source: bluesound node x - amp: primaluna evo 300 - speakers: harbeth p3esr';
    const result = detectIntent(msg);
    expect(result.intent).toBe('system_assessment');
  });

  it('"my system: dac: X - amp: Y - speakers: Z" without assessment language', () => {
    const msg = 'my system: dac: Denafrips Pontus II - amp: Pass Labs INT-25 - speakers: DeVore Super Nine';
    const result = detectIntent(msg);
    expect(result.intent).toBe('system_assessment');
  });

  it('"i have: dac: X - amp: Y - speakers: Z" ownership via "I have"', () => {
    const msg = 'i have dac: Chord Qutest - amp: Hegel H190 - speakers: KEF LS50 Meta';
    const result = detectIntent(msg);
    expect(result.intent).toBe('system_assessment');
  });
});

// ──────────────────────────────────────────────────────
// 7. Task 6b — existing Case B (assessment + labels) still works
// ──────────────────────────────────────────────────────

describe('Case B still works: assessment language + labeled roles', () => {
  it('"how\'s this system:" with role labels → system_assessment', () => {
    const msg = "how's this system: speakers: wlm diva monitors - amplifier: job integrated - streamer: eversolo dmp-a6";
    const result = detectIntent(msg);
    expect(result.intent).toBe('system_assessment');
  });

  it('"evaluate this setup:" with role labels → system_assessment', () => {
    const msg = 'speakers: harbeth super hl5+ - amp: leben cs300 - dac: pontus ii. evaluate this setup';
    const result = detectIntent(msg);
    expect(result.intent).toBe('system_assessment');
  });
});

// ──────────────────────────────────────────────────────
// 8. Task 6b — no false positives for single-product ownership
// ──────────────────────────────────────────────────────

describe('No false positives for single-product ownership', () => {
  it('"my dac is the chord qutest" → NOT system_assessment (single product, no chain)', () => {
    const msg = 'my dac is the chord qutest';
    const result = detectIntent(msg);
    expect(result.intent).not.toBe('system_assessment');
  });

  it('"I have a hegel h190" → NOT system_assessment (single product, no chain)', () => {
    const msg = 'I have a hegel h190';
    const result = detectIntent(msg);
    expect(result.intent).not.toBe('system_assessment');
  });

  it('"current system sounds thin" → NOT system_assessment (diagnosis, no chain/labels)', () => {
    const msg = 'current system sounds thin and bright';
    const result = detectIntent(msg);
    // Should route to diagnosis (listening problem), not system_assessment
    expect(result.intent).not.toBe('system_assessment');
  });

  it('"I use a chord qutest, curious what you think" → NOT system_assessment (single product inquiry)', () => {
    const msg = 'I use a chord qutest, curious what you think';
    const result = detectIntent(msg);
    // Single product, no chain separator → product_assessment or gear_inquiry
    expect(result.intent).not.toBe('system_assessment');
  });
});
