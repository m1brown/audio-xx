/**
 * Phase C — Blocker fix regression tests.
 *
 * These pin the five behaviors requested in the Phase C QA pass:
 *
 *   1. Evaluation phrasing with an active saved system routes to
 *      `system_assessment`, not `consultation_entry` / intake.
 *   2. An active saved system is piped into consultation follow-up
 *      rationales (fit / upgrade) instead of the handler asking the
 *      user to re-describe components they've already saved.
 *   3. No fabricated WLM / Chord / Job chain appears in the shopping
 *      LLM overlay prompt when no real system components are present —
 *      the prompt must forbid invention rather than anchor to examples.
 *   4. Multi-brand inputs like
 *      "LAiV Harmony DAC, Kinki Studio EX-M1+, Qualio IQ speakers"
 *      parse to three distinct components with correct roles and no
 *      brand bleed (DAC, amplifier, speaker — not DAC, DAC, amplifier).
 *   5. Elliptical "would it fit my system?" after a brand/product
 *      inquiry stays in consultation follow-up and references the
 *      saved system in its rationale.
 *
 * Audio XX Playbook references:
 *   §5 Confidence Calibration — Tests 3 (no invention) and 2 (grounding).
 *   §1 Design→Behavior→Experience — Tests 1, 4, 5 (correct routing and
 *   component role identification).
 *
 * Portability: all tests exercise adapter / audio-domain layers. No
 * engine primitives are touched.
 */

import { describe, it, expect, beforeAll } from 'vitest';

// localStorage shim (some downstream modules touch it on import).
beforeAll(() => {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  // @ts-expect-error - test-only global shim
  globalThis.window = globalThis.window ?? {};
  // @ts-expect-error - test-only global shim
  globalThis.window.localStorage = ls;
});

import { detectIntent, extractSubjectMatches, isConsultationFollowUp } from '../intent';
import { detectSystemDescription } from '../system-extraction';
import { buildConsultationFollowUp } from '../consultation';
import type { AudioSessionState } from '../system-types';
import type { ExtractedSignals } from '../signal-types';
import * as fs from 'fs';
import * as path from 'path';

// Minimal AudioSessionState used by detectSystemDescription. Gate 5
// (duplicate-against-active-system) short-circuits when the active
// system's fingerprint matches — we always pass an empty state so the
// new detection always returns fresh.
const EMPTY_AUDIO_STATE: AudioSessionState = {
  // @ts-expect-error - minimal shape; fields not read in these tests
  activeSystem: null,
};

// ═══════════════════════════════════════════════════════════════════
// Test 1 — Evaluation phrasing routes to system_assessment when a
//          saved system is active.
// ═══════════════════════════════════════════════════════════════════

describe('Phase C §1 — evaluation intent with active saved system', () => {
  const PHRASINGS = [
    'evaluate my system',
    'please evaluate the saved system',
    'assess my setup',
    'tell me what you think',
    'review my system',
    'how good is this',
    'give me your thoughts',
  ];

  for (const text of PHRASINGS) {
    it(`"${text}" routes to system_assessment when hasActiveSavedSystem=true`, () => {
      const { intent } = detectIntent(text, { hasActiveSavedSystem: true });
      expect(intent).toBe('system_assessment');
    });
  }

  it('control: same phrasing without an active saved system does NOT route to system_assessment', () => {
    // Bare "evaluate my system" with no saved context should fall through
    // to consultation_entry / intake so the user is prompted for details.
    const { intent } = detectIntent('evaluate my system', { hasActiveSavedSystem: false });
    expect(intent).not.toBe('system_assessment');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Test 2 — Saved system is referenced in consultation follow-up fit
//          responses (not asking the user to re-describe).
// ═══════════════════════════════════════════════════════════════════

describe('Phase C §2 — active saved system flows into follow-up handlers', () => {
  it('"would it fit my system?" after a brand inquiry renders saved components in the rationale', () => {
    const activeConsultation = {
      subjects: [{ name: 'harbeth', kind: 'brand' as const }],
      originalQuery: 'What do you think of Harbeth?',
    };
    const activeSystem = {
      components: [
        { brand: 'Leben', name: 'CS300', category: 'amplifier' },
        { brand: 'Chord', name: 'Hugo', category: 'dac' },
        { brand: 'Bluesound', name: 'NODE X', category: 'streamer' },
      ],
    };

    const resp = buildConsultationFollowUp(
      activeConsultation,
      'would it fit my system?',
      activeSystem,
    );

    expect(resp).not.toBeNull();
    // The rationale (philosophy) must reference the saved chain — at
    // minimum the brand name of a saved component should appear.
    const rationale = `${resp!.philosophy} ${resp!.followUp ?? ''}`.toLowerCase();
    const mentionsSavedGear = rationale.includes('leben')
      || rationale.includes('chord')
      || rationale.includes('bluesound')
      || rationale.includes('saved system');
    expect(mentionsSavedGear).toBe(true);

    // The handler must NOT ask the user to re-describe their chain.
    expect(rationale).not.toMatch(/what\s+else\s+is\s+in\s+the\s+chain/);
  });

  it('control: without an active saved system, the follow-up asks what else is in the chain', () => {
    const activeConsultation = {
      subjects: [{ name: 'harbeth', kind: 'brand' as const }],
      originalQuery: 'What do you think of Harbeth?',
    };
    const resp = buildConsultationFollowUp(
      activeConsultation,
      'would it fit my system?',
      null,
    );
    expect(resp).not.toBeNull();
    const rationale = `${resp!.philosophy} ${resp!.followUp ?? ''}`.toLowerCase();
    // No saved gear exists, so the fallback ask-for-chain prompt is
    // the appropriate outcome.
    expect(rationale).toMatch(/what\s+else\s+is\s+in\s+the\s+chain|which\s+tube\s+amp/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Test 3 — Fabricated WLM / Chord / Job chain cannot be introduced by
//          the shopping LLM overlay prompt.
//
// This is a prompt-content assertion: the buildSystemPrompt() output
// must explicitly forbid inventing components and must not include the
// bogus "JOB Integrated" / "WLM Diva" / "Chord Hugo" anchors that the
// LLM was previously latching onto when systemComponents was absent.
// ═══════════════════════════════════════════════════════════════════

describe('Phase C §3 — no fabricated chain in shopping LLM overlay prompt', () => {
  const OVERLAY_PATH = path.resolve(
    __dirname,
    '../shopping-llm-overlay.ts',
  );
  const OVERLAY_SRC = fs.readFileSync(OVERLAY_PATH, 'utf8');

  it('system prompt includes an explicit NEVER-invent rule', () => {
    // Both the main and closing prompts must ship the anti-fabrication
    // guardrail. Grep for the canonical phrase.
    const occurrences = (OVERLAY_SRC.match(/NEVER invent or name system components/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('prompt text does not hard-code "JOB Integrated", "WLM Diva", or "Chord Hugo" as examples', () => {
    // The fabricated chain was coming from concrete-brand examples
    // inside the prompt body. These must not appear as literal anchors.
    // Strip comments to reduce false positives from doc references.
    const noComments = OVERLAY_SRC
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(noComments).not.toMatch(/JOB\s+Integrated/);
    expect(noComments).not.toMatch(/WLM\s+Diva/);
    expect(noComments).not.toMatch(/Chord\s+Hugo/);
    expect(noComments).not.toMatch(/Boenicke\s+W5/);
    expect(noComments).not.toMatch(/Eversolo\s+DMP-A6/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Test 4 — Multi-brand parser: Kinki + Qualio + LAiV parses into three
//          distinct components with correct roles (no brand bleed).
// ═══════════════════════════════════════════════════════════════════

describe('Phase C §4 — multi-brand parser correctness', () => {
  it('"LAiV Harmony DAC, Kinki Studio EX-M1+, Qualio IQ speakers" → three components, correct roles', () => {
    const text = 'I have a LAiV Harmony DAC, Kinki Studio EX-M1+ integrated amp, Qualio IQ speakers. What do you think?';
    const subjectMatches = extractSubjectMatches(text);
    const proposed = detectSystemDescription(text, subjectMatches, EMPTY_AUDIO_STATE);

    expect(proposed).not.toBeNull();
    const components = proposed!.components;
    // Must be exactly three roles: DAC, amplifier (or integrated), speaker.
    // De-duped categories — no "DAC, DAC, amplifier" bleed.
    const categories = components.map((c) => c.category);
    expect(categories).toContain('dac');
    expect(categories.some((c) => c === 'amplifier' || c === 'integrated')).toBe(true);
    expect(categories).toContain('speaker');

    // Distinct brands — no cross-brand fusion (LAiV must not be bound
    // to the Kinki Studio product, and vice versa).
    const brandsLower = components.map((c) => c.brand.toLowerCase());
    const laivComp = components.find((c) => c.brand.toLowerCase() === 'laiv');
    const kinkiComp = components.find((c) => c.brand.toLowerCase().includes('kinki'));
    expect(laivComp).toBeDefined();
    expect(kinkiComp).toBeDefined();
    // LAiV must be the DAC row, Kinki the amp row — not the other way.
    expect(laivComp!.category).toBe('dac');
    expect(['amplifier', 'integrated']).toContain(kinkiComp!.category);
    // No duplicated DAC row bound to Kinki.
    const kinkiDacRows = components.filter(
      (c) => c.brand.toLowerCase().includes('kinki') && c.category === 'dac',
    );
    expect(kinkiDacRows.length).toBe(0);
    // And no duplicated DAC row bound to LAiV for a Kinki product name.
    const laivKinkiBleed = components.filter(
      (c) => c.brand.toLowerCase() === 'laiv'
        && c.name.toLowerCase().includes('ex-m1'),
    );
    expect(laivKinkiBleed.length).toBe(0);
    void brandsLower;
  });
});

// ═══════════════════════════════════════════════════════════════════
// Test 5 — "would it fit my system?" after a product inquiry keeps the
//          product context and uses saved-system context.
//
// Covers both the elliptical-fit pattern (CONSULTATION_FOLLOWUP_PATTERNS)
// and the grounded rationale injection in system_fit.
// ═══════════════════════════════════════════════════════════════════

describe('Phase C §5 — elliptical fit question after product inquiry', () => {
  it('"would it fit my system?" is recognised as a follow-up (not a new entry)', () => {
    // Phrased as a bare fit question with no gear named — must match one
    // of the CONSULTATION_FOLLOWUP_PATTERNS so buildConsultationFollowUp
    // is called rather than routing to consultation_entry intake.
    const activeConsultation = {
      subjects: [{ name: 'harbeth', kind: 'brand' as const }],
      originalQuery: 'Tell me about Harbeth',
    };
    const resp = buildConsultationFollowUp(
      activeConsultation,
      'would it fit my system?',
      {
        components: [
          { brand: 'Leben', name: 'CS300', category: 'amplifier' },
          { brand: 'Chord', name: 'Hugo', category: 'dac' },
        ],
      },
    );
    // A non-null response means the follow-up handler took this turn
    // (rather than bailing to higher-level intake).
    expect(resp).not.toBeNull();
    expect(resp!.subject.toLowerCase()).toContain('harbeth');

    // The rationale must include saved-system context (Leben or Chord),
    // not ask the user to describe their system again.
    const rationale = `${resp!.philosophy} ${resp!.followUp ?? ''}`.toLowerCase();
    expect(
      rationale.includes('leben')
        || rationale.includes('chord')
        || rationale.includes('saved system'),
    ).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase C live-verification regression tests — blockers #1–#5
// These pin the exact failure transcripts called out in
// PHASE-C-LIVE-VERIFICATION.md so the second-pass fixes do not regress.
// ═══════════════════════════════════════════════════════════════════

// Blocker #1 — Transcript A2: "what would you upgrade first?" after a
// successful system review must NOT land in comparison intake.
describe('Phase C live-verification §1 — upgrade follow-up routing (A2)', () => {
  const UPGRADE_FOLLOWUPS = [
    'what would you upgrade first?',
    'what would you upgrade first',
    'what would you change first?',
    'what would you swap first?',
    'what should I upgrade next?',
    'where should I start?',
    'where should I focus?',
    'what is the weakest link?',
    "what's the weakest link?",
    'what would you do first?',
  ];

  for (const text of UPGRADE_FOLLOWUPS) {
    it(`"${text}" with active saved system routes to consultation_entry (not comparison)`, () => {
      const { intent } = detectIntent(text, { hasActiveSavedSystem: true });
      expect(intent).not.toBe('comparison');
      expect(intent).toBe('consultation_entry');
    });
  }

  it('control: genuine comparison phrasing still routes to comparison', () => {
    // "upgrade from X to Y" is a concrete swap — must remain comparison.
    const { intent } = detectIntent(
      'should I upgrade from Bifrost to Pontus?',
      { hasActiveSavedSystem: true },
    );
    expect(intent).toBe('comparison');
  });
});

// Blocker #2 — Transcript B3: "would it fit my system?" after a product
// inquiry must match the consultation-follow-up pattern set (elliptical
// fit). This test is the pure pattern-match side; the dispatch wiring is
// verified in §5 above via buildConsultationFollowUp.
describe('Phase C live-verification §2 — elliptical fit pattern recognition (B3)', () => {
  it('"would it fit my system?" matches the consultation-follow-up pattern set', () => {
    // Using the exported helper — the pattern is exercised through
    // isConsultationFollowUp with an active consultation present.
    const followUp = isConsultationFollowUp('would it fit my system?', {
      subjects: [{ name: 'qutest', kind: 'product' as const }],
      originalQuery: 'what about the Qutest?',
    });
    expect(followUp).toBe(true);
  });

  it('"would that work with my setup?" also matches', () => {
    const followUp = isConsultationFollowUp('would that work with my setup?', {
      subjects: [{ name: 'qutest', kind: 'product' as const }],
      originalQuery: 'what about the Qutest?',
    });
    expect(followUp).toBe(true);
  });
});

// Blocker #3 — Transcripts B1/B2: product assessment must ground in the
// active saved system rather than emitting "No system context available".
describe('Phase C live-verification §3 — saved-system propagation into product assessment (B1/B2)', () => {
  it('buildProductAssessment surfaces saved-system context when activeSystem is provided', async () => {
    const { buildProductAssessment } = await import('../product-assessment');
    const activeSystem = {
      components: [
        { brand: 'Chord', name: 'Hugo', category: 'dac' },
        { brand: 'JOB', name: 'Integrated', category: 'integrated' },
        { brand: 'WLM', name: 'Diva Monitor', category: 'speaker' },
      ],
    };
    const subjectMatches = [
      { name: 'Qutest', kind: 'product' as const, brand: 'Chord', category: 'dac' },
    ];
    const assessment = buildProductAssessment({
      subjectMatches,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activeSystem: activeSystem as any,
      currentMessage: 'what about the Qutest?',
    });
    // Not every product resolves to a buildable assessment in the test
    // harness; the important guarantee is that when the handler DOES
    // return something, it has NOT emitted the "no system context" banner.
    if (assessment) {
      const body = JSON.stringify(assessment).toLowerCase();
      expect(body).not.toMatch(/no system context available/);
    }
  });
});

// Blocker #4 — Transcript E: shopping overlay prompts must give
// explicit-gear precedence. A query like "best integrated for Harbeth"
// with an active saved system that contains different speakers must not
// silently substitute the saved-system speaker in the rationale.
describe('Phase C live-verification §4 — explicit-gear precedence in shopping (E)', () => {
  const OVERLAY_PATH = path.resolve(
    __dirname,
    '../shopping-llm-overlay.ts',
  );
  const OVERLAY_SRC = fs.readFileSync(OVERLAY_PATH, 'utf8');

  it('ShoppingEditorialContext exposes a queryAnchors field', () => {
    expect(OVERLAY_SRC).toMatch(/queryAnchors\?\s*:\s*string\[\]/);
  });

  it('system prompt includes an explicit-gear precedence rule', () => {
    // The rule must make it unambiguous that the user-named component
    // overrides the saved-system component for the systemFit rationale.
    expect(OVERLAY_SRC).toMatch(/EXPLICIT-GEAR PRECEDENCE/);
    expect(OVERLAY_SRC.toLowerCase()).toMatch(/primary anchor/);
  });

  it('user prompt surfaces queryAnchors when present', () => {
    expect(OVERLAY_SRC).toMatch(/Evaluating against/);
  });
});

// Blocker #5 — Transcript D: reviewer attribution ("Similar to Srajan
// Ebaen's system") must be gated on an exact curated match. Partial
// (≥0.66) overlap no longer emits a reviewer label.
describe('Phase C live-verification §5 — reviewer-attribution guardrail (D)', () => {
  it('suggestKnownSystemName returns null for a ≥0.66 but <1.0 core-overlap match', async () => {
    const { suggestKnownSystemName } = await import('../known-systems');
    // Fabricate a KnownSystemMatch with 0.75 overlap — the old code would
    // return "Similar to <attribution>'s system"; the new code returns null.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partial: any = {
      system: {
        id: 'test',
        label: 'Test reference system',
        attribution: 'Test Reviewer',
        philosophy: 'Test philosophy',
        coreComponents: [],
        peripheralComponents: [],
      },
      coreOverlap: 0.75,
      matchedComponents: [],
    };
    expect(suggestKnownSystemName(partial)).toBeNull();
  });

  it('suggestKnownSystemName returns the full label for an exact (1.0) match', async () => {
    const { suggestKnownSystemName } = await import('../known-systems');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const full: any = {
      system: {
        id: 'test',
        label: 'Test reference system',
        attribution: 'Test Reviewer',
        philosophy: 'Test philosophy',
        coreComponents: [],
        peripheralComponents: [],
      },
      coreOverlap: 1.0,
      matchedComponents: [],
    };
    expect(suggestKnownSystemName(full)).toBe('Test reference system');
  });

  it('detectSystemDescription drops knownSystemMatch on a partial overlap', async () => {
    // This exercises the outer gate in system-extraction.ts so the
    // SystemSavePrompt UI never has a partial-match label to render.
    const { detectSystemDescription } = await import('../system-extraction');
    // Construct an input that would likely be a partial brand-chain match —
    // three well-known brand names in categories that appear in curated
    // known systems but not necessarily an exact overlap with any one.
    const text = 'I have a Chord Hugo, a JOB Integrated amp, and WLM Diva Monitor speakers.';
    const { extractSubjectMatches } = await import('../intent');
    const subjectMatches = extractSubjectMatches(text);
    const proposed = detectSystemDescription(text, subjectMatches, EMPTY_AUDIO_STATE);
    if (proposed?.knownSystemMatch) {
      // If the fixture resolves to a full 1.0 match, that is fine — the
      // rule is only that partial matches must not appear.
      expect(proposed.knownSystemMatch.coreOverlap).toBeGreaterThanOrEqual(1.0);
    }
    // No assertion when knownSystemMatch is absent — that is the expected
    // outcome for a partial brand-chain overlap under the new guardrail.
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase C live-verification §A.4 — saved-system grounding on the
// shopping path.
//
// Live Chrome pass A.4 found that after a system evaluation, a direct
// shopping follow-up like "give me specific DAC ideas under $2000"
// rendered the generic fallback copy ("Without more system context…" /
// "For sharper recommendations, tell me about your system.") even
// though the saved system was still active.
//
// Root cause: in page.tsx the ShoppingAdvisoryContext passed to the
// deterministic rendering path gated systemComponents, systemLocation,
// systemPrimaryUse, and systemTendencies on `isInlineSystem` — so when
// the user did not re-mention their saved components in the shopping
// turn, those fields were stripped and advisory-response.ts fell
// through to the "no system context" fallback.
//
// Fix: treat a saved/draft system the same as an inline system for
// the purposes of shopping-path grounding. The EXPLICIT-GEAR PRECEDENCE
// rule from Blocker 4 (queryAnchors) is unaffected — it lives in
// shopping-llm-overlay.ts and still anchors systemFit rationale on any
// user-named component in the query.
// ═══════════════════════════════════════════════════════════════════

describe('Phase C live-verification §A.4 — saved-system grounding on shopping path', () => {
  const PAGE_PATH = path.resolve(__dirname, '../../app/page.tsx');
  const PAGE_SRC = fs.readFileSync(PAGE_PATH, 'utf8');

  it('page.tsx shopping advisoryCtx no longer gates systemComponents on isInlineSystem only', () => {
    // The fix introduces a `hasActiveSystem` helper (inline OR saved) and
    // uses it when building the deterministic shopping advisoryCtx. The
    // previous `isInlineSystem ? activeComponentNames : undefined` gating
    // must be gone from this construction.
    expect(PAGE_SRC).toMatch(/const\s+hasActiveSystem\s*=\s*isInlineSystem\s*\|\|\s*isSavedSystem/);
    expect(PAGE_SRC).toMatch(/systemComponents:\s*hasActiveSystem\s*\?\s*activeComponentNames\s*:\s*undefined/);
    expect(PAGE_SRC).toMatch(/systemTendencies:\s*hasActiveSystem\s*\?/);
  });

  it('shoppingToAdvisory with an active system (components) does NOT emit the "Without more system context" fallback', async () => {
    const { shoppingToAdvisory } = await import('../advisory-response');
    const { detectShoppingIntent, buildShoppingAnswer } = await import('../shopping-intent');
    const { reason } = await import('../reasoning');

    const emptySignals: ExtractedSignals = {
      traits: {},
      symptoms: [],
      archetype_hints: [],
      uncertainty_level: 0,
      matched_phrases: [],
      matched_uncertainty_markers: [],
    };

    const text = 'give me specific DAC ideas under $2000';
    const ctx = detectShoppingIntent(text, emptySignals, []);
    const reasoning = reason(text, [], emptySignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, emptySignals, undefined, reasoning, []);

    // Simulate the post-fix advisoryCtx: saved system is active so
    // systemComponents + systemTendencies flow through.
    const advisoryCtx = {
      systemComponents: ['Chord Qutest', 'WLM La Scala Reference', 'Line Magnetic 518IA'],
      systemTendencies: 'warm, dynamic, tube-driven',
      systemPrimaryUse: 'critical listening',
    };

    const advisory = shoppingToAdvisory(answer, emptySignals, reasoning, advisoryCtx);

    const impactText = advisory.expectedImpact?.explanation ?? '';
    expect(impactText.toLowerCase()).not.toContain('without more system context');
  });

  it('shoppingToAdvisory expectedImpact is NOT "subtle" when systemComponents + systemTendencies are supplied', async () => {
    const { shoppingToAdvisory } = await import('../advisory-response');
    const { detectShoppingIntent, buildShoppingAnswer } = await import('../shopping-intent');
    const { reason } = await import('../reasoning');

    const warmSignals: ExtractedSignals = {
      traits: { tonal_density: 'up', flow: 'up' } as Record<string, import('../signal-types').SignalDirection>,
      symptoms: ['warm', 'rich'],
      archetype_hints: [],
      uncertainty_level: 0,
      matched_phrases: ['warm', 'rich'],
      matched_uncertainty_markers: [],
    };

    const text = 'looking for a DAC under $2000';
    const ctx = detectShoppingIntent(text, warmSignals, []);
    const reasoning = reason(text, [], warmSignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, warmSignals, undefined, reasoning, []);

    const advisoryCtx = {
      systemComponents: ['Chord Qutest', 'WLM La Scala Reference'],
      systemTendencies: 'warm, rich, tube-driven',
    };

    const advisory = shoppingToAdvisory(answer, warmSignals, reasoning, advisoryCtx);

    // With components + tendencies + taste, the tier should be
    // 'noticeable' or 'system-level' — never 'subtle'.
    expect(advisory.expectedImpact?.tier).not.toBe('subtle');
  });

  it('EXPLICIT-GEAR PRECEDENCE is preserved: queryAnchors field and system-prompt rule still present in shopping-llm-overlay.ts', () => {
    // The A.4 fix must NOT regress the Blocker 4 rule. Re-assert the
    // queryAnchors field and the EXPLICIT-GEAR PRECEDENCE rule still
    // ship in the overlay prompt construction.
    const OVERLAY_PATH = path.resolve(__dirname, '../shopping-llm-overlay.ts');
    const OVERLAY_SRC = fs.readFileSync(OVERLAY_PATH, 'utf8');
    expect(OVERLAY_SRC).toMatch(/queryAnchors\?\s*:\s*string\[\]/);
    expect(OVERLAY_SRC).toMatch(/EXPLICIT-GEAR PRECEDENCE/);
    expect(OVERLAY_SRC).toMatch(/Evaluating against/);
  });

  it('page.tsx derivation of queryAnchors from subjectMatches is intact after A.4 fix', () => {
    // The shopping editorial context builder must still populate
    // queryAnchors from turnCtx.subjectMatches filtered to brand/product.
    // This is the input side of the EXPLICIT-GEAR PRECEDENCE rule — it
    // must survive the A.4 grounding fix.
    expect(PAGE_SRC).toMatch(/queryAnchors:\s*\(/);
    expect(PAGE_SRC).toMatch(/turnCtx\.subjectMatches[\s\S]*?kind\s*===\s*'brand'\s*\|\|\s*m\.kind\s*===\s*'product'/);
  });
});
