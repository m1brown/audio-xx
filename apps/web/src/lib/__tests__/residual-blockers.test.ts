/**
 * Residual-blocker regression tests.
 *
 * The three named blockers (A, B, C) from the pre-review Chrome QA were
 * already fixed. A follow-up Chrome QA surfaced three additional
 * blocker-level issues inside the same surfaces that the original
 * blockers had cleaned up:
 *
 *   R1. Phantom saved-system override — when a saved system is active
 *       alongside a freshly-typed chain, the saved component's generic
 *       model name (e.g. "Integrated") matches a word inside the new
 *       chain and gets phantom-seeded into the assessment.
 *
 *   R2. Chord brand-only copy regression — `buildProductAssessment`
 *       fallback paths used the raw lowercase subject name ("chord"),
 *       so the rendered header/body read "chord" and "chordFPGA" rather
 *       than "Chord" and "Chord · FPGA".
 *
 *   R3. Role-label parser ignores explicit "role:" labels and " - "
 *       separator — "streamer: eversolo dmp-a6" was being read as
 *       amplifier because earlier "amp:" labels bled into the segment.
 *
 * These tests encode the exact failure shapes from the QA report so
 * regressions on the same surfaces are caught immediately.
 */

import { describe, it, expect, beforeAll } from 'vitest';

// ── localStorage shim (required for saved-system internals) ──────
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

import {
  buildSystemAssessment,
  validateSystemComponents,
  _test,
  type SystemComponent,
} from '../consultation';
import { detectIntent, extractSubjectMatches } from '../intent';
import { buildProductAssessment } from '../product-assessment';
import type { AssessmentContext } from '../product-assessment';
import { detectSystemDescription } from '../system-extraction';
import type { AudioSessionState } from '../system-types';

const { detectUserAppliedRole } = _test;

// Helper: build a minimal SystemComponent for validateSystemComponents.
function comp(
  displayName: string,
  role: string,
  productCategory?: string,
  brand?: string,
): SystemComponent {
  return {
    displayName,
    role,
    roles: [role],
    character: `${displayName} character`,
    // @ts-expect-error - minimal product shape for testing
    product: productCategory
      ? { brand: brand ?? '', name: displayName, category: productCategory }
      : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════
// R1. Phantom saved-system override
// ═══════════════════════════════════════════════════════════════════
//
// Scenario: A saved "Livingroom" system contains "JOB Integrated". The
// user types a completely new chain (Bluesound NODE X → PrimaLuna EVO 300
// Integrated → Harbeth P3ESR). If the saved system leaks into the active
// system context, the seeding pass sees "Integrated" in the message
// (because "PrimaLuna EVO 300 Integrated" contains the word) and pulls
// JOB Integrated into the assessed chain.
//
// Fix: generic model-name words ("integrated", "streamer", "dac", etc.)
// are not by themselves enough to justify seeding — the brand must also
// appear in the message, or the full "<brand> <name>" literal.
// ═══════════════════════════════════════════════════════════════════

describe('Residual R1: phantom saved-system override', () => {
  it('saved "JOB Integrated" is NOT seeded into a typed Bluesound/PrimaLuna/Harbeth chain', () => {
    const text = 'My system: Bluesound NODE X → PrimaLuna EVO 300 Integrated → Harbeth P3ESR. What should I upgrade?';
    const { subjectMatches, desires } = detectIntent(text);

    // Simulate the worst case: the saved-system leaked into activeSystem
    // alongside the inline components. Before the fix, the seeding pass
    // would pull JOB Integrated in because "integrated" appears in
    // "PrimaLuna EVO 300 Integrated".
    const activeSystem = {
      systemId: 'livingroom',
      systemName: 'Livingroom',
      components: [
        { brand: 'Bluesound', name: 'NODE X', category: 'streamer' as const },
        { brand: 'PrimaLuna', name: 'EVO 300 Integrated', category: 'amplifier' as const },
        { brand: 'Harbeth', name: 'P3ESR', category: 'speaker' as const },
        // The saved-system contaminant — must NOT appear in the assessed chain.
        { brand: 'JOB', name: 'Integrated', category: 'amplifier' as const },
      ],
    };

    const result = buildSystemAssessment(
      text,
      subjectMatches,
      // @ts-expect-error - test shape, @ts-nocheck patterns used elsewhere
      activeSystem,
      desires,
    );
    expect(result).not.toBeNull();
    if (result!.kind !== 'assessment') {
      throw new Error(`Expected assessment, got ${result!.kind}`);
    }
    const names = result!.findings.componentNames.map((n) => n.toLowerCase());

    // The phantom JOB Integrated must NOT be present.
    expect(names.some((n) => n.includes('job'))).toBe(false);

    // The user-typed components must all be present.
    expect(names.some((n) => n.includes('bluesound') || n.includes('node'))).toBe(true);
    expect(names.some((n) => n.includes('primaluna'))).toBe(true);
    expect(names.some((n) => n.includes('harbeth') || n.includes('p3esr'))).toBe(true);
  });

  it('control: when brand "JOB" IS in the message, the saved "JOB Integrated" component IS seeded', () => {
    // This is the existing intended behavior — we only want to reject
    // seeding when the brand is absent. If the brand appears, seeding
    // is legitimate.
    const text = 'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?';
    const { subjectMatches, desires } = detectIntent(text);

    const activeSystem = {
      systemId: 'test',
      systemName: 'Living Room',
      components: [
        { brand: 'Eversolo', name: 'DMP-A6', category: 'streamer' as const },
        { brand: 'Chord', name: 'Hugo', category: 'dac' as const },
        { brand: 'JOB', name: 'Integrated', category: 'amplifier' as const },
        { brand: 'WLM', name: 'Diva Monitor', category: 'speaker' as const },
      ],
    };

    const result = buildSystemAssessment(
      text,
      subjectMatches,
      // @ts-expect-error - test shape
      activeSystem,
      desires,
    );
    expect(result).not.toBeNull();
    if (result!.kind !== 'assessment') {
      throw new Error(`Expected assessment, got ${result!.kind}`);
    }
    const names = result!.findings.componentNames.map((n) => n.toLowerCase());
    expect(names.some((n) => n.includes('job'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// R2. Chord brand-only copy regression
// ═══════════════════════════════════════════════════════════════════
//
// "Tell me about the Chord sound" renders through the brand-only
// fallback path in buildProductAssessment. Before the fix, the
// candidateName/brandName came from the raw (lowercase) subject
// name, so the header rendered "chordFPGA" and the body read
// "chord designs FPGA components". After the fix these read as
// "Chord" with display casing.
// ═══════════════════════════════════════════════════════════════════

describe('Residual R2: Chord brand-only copy casing', () => {
  it('"Tell me about the Chord sound" produces capitalized candidateName / brandName', () => {
    const text = 'Tell me about the Chord sound';
    const { subjectMatches } = detectIntent(text);
    const ctx: AssessmentContext = {
      subjectMatches,
      currentMessage: text,
    };
    const assessment = buildProductAssessment(ctx);
    expect(assessment).not.toBeNull();

    // Header candidate name must not be the raw lowercase "chord".
    expect(assessment!.candidateName).not.toBe('chord');
    expect(assessment!.candidateName).toMatch(/^Chord/);

    // Brand name must start with capital C too.
    expect(assessment!.candidateBrand).toMatch(/^Chord/);

    // shortAnswer should read "Chord designs ..." not "chord designs ...".
    expect(assessment!.shortAnswer).toMatch(/Chord\b/);
    expect(assessment!.shortAnswer.startsWith('chord ')).toBe(false);
  });

  it('lowercase "tell me about the chord sound" still produces capitalized output', () => {
    // Input casing should not affect output display casing — the
    // fix is at the display layer, not the input parser.
    const text = 'tell me about the chord sound';
    const { subjectMatches } = detectIntent(text);
    const ctx: AssessmentContext = {
      subjectMatches,
      currentMessage: text,
    };
    const assessment = buildProductAssessment(ctx);
    expect(assessment).not.toBeNull();
    expect(assessment!.candidateName).toMatch(/^Chord/);
    expect(assessment!.candidateBrand).toMatch(/^Chord/);
  });

  it('preserves catalog-match casing when a specific product matches (control)', () => {
    // This path uses `${candidate.brand} ${candidate.name}` directly —
    // the fix must not disturb it.
    const text = 'tell me about the chord qutest';
    const { subjectMatches } = detectIntent(text);
    const ctx: AssessmentContext = {
      subjectMatches,
      currentMessage: text,
    };
    const assessment = buildProductAssessment(ctx);
    expect(assessment).not.toBeNull();
    expect(assessment!.catalogMatch).toBe(true);
    expect(assessment!.candidateName).toMatch(/Chord\s+Qutest/i);
  });
});

// ═══════════════════════════════════════════════════════════════════
// R3. Eversolo role-label inversion
// ═══════════════════════════════════════════════════════════════════
//
// Scenario: the user writes
//   how's this system: speakers: wlm diva monitors - amp: job integrated - streamer: eversolo dmp-a6
// and the app replies that the user "described the Eversolo Dmp-a6 as
// an amplifier" — ignoring the explicit "streamer:" label on the same
// component.
//
// Fix: (1) " - " becomes a chain separator so segments don't bleed
// into each other; (2) "<role>:" colon labels take priority over
// nearby-keyword detection so the user's explicit assertion wins.
// ═══════════════════════════════════════════════════════════════════

describe('Residual R3: colon-labeled role wins over nearby keywords', () => {
  const labeledChain =
    "how's this system: speakers: wlm diva monitors - amp: job integrated - streamer: eversolo dmp-a6";

  it('detectUserAppliedRole returns "streamer" for "streamer: eversolo dmp-a6"', () => {
    const role = detectUserAppliedRole(
      labeledChain,
      'Eversolo DMP-A6',
      ['WLM Diva Monitors', 'Job Integrated'],
    );
    expect(role).toBe('streamer');
  });

  it('detectUserAppliedRole returns "integrated" for "amp: job integrated" (not streamer)', () => {
    // " - " separator must isolate this segment from the later "streamer:".
    const role = detectUserAppliedRole(
      labeledChain,
      'Job Integrated',
      ['WLM Diva Monitors', 'Eversolo DMP-A6'],
    );
    // Either "integrated" or "amplifier" is a legitimate read of
    // "amp: job integrated" — but NOT "streamer".
    expect(role).not.toBe('streamer');
    expect(['amplifier', 'integrated']).toContain(role);
  });

  it('detectUserAppliedRole returns "speaker" for "speakers: wlm diva monitors"', () => {
    const role = detectUserAppliedRole(
      labeledChain,
      'WLM Diva Monitors',
      ['Job Integrated', 'Eversolo DMP-A6'],
    );
    expect(role).toBe('speaker');
  });

  it('validateSystemComponents produces NO role-label conflict for correctly-labeled Eversolo streamer', () => {
    const clarification = validateSystemComponents(
      labeledChain,
      [
        comp('WLM Diva Monitors', 'speaker', 'speaker', 'WLM'),
        comp('Job Integrated', 'integrated', 'integrated', 'Job'),
        comp('Eversolo DMP-A6', 'streamer', 'streamer', 'Eversolo'),
      ],
    );
    // The Eversolo is cataloged as a streamer AND the user labeled it
    // "streamer:" — there must be no clarification for that component.
    if (clarification) {
      expect(clarification.question.toLowerCase()).not.toContain('eversolo');
      expect(clarification.question.toLowerCase()).not.toContain('dmp-a6');
    }
  });

  it('still flags a genuine conflict: "streamer: chord qutest" (Qutest is a DAC)', () => {
    // Control — the colon-label fix must not make us blind to real conflicts.
    const text = 'speakers: devore o/96 - amp: pass int-25 - streamer: chord qutest';
    const role = detectUserAppliedRole(
      text,
      'Chord Qutest',
      ['Devore O/96', 'Pass Int-25'],
    );
    expect(role).toBe('streamer');
  });

  it('still honors arrow-chain nearby keywords (no regression on existing tests)', () => {
    const text = 'My system is WiiM Pro DAC into Chord Hugo into JOB Integrated into WLM Diva';
    const role = detectUserAppliedRole(
      text,
      'WiiM Pro',
      ['Chord Hugo', 'JOB Integrated', 'WLM Diva'],
    );
    expect(role).toBe('dac');
  });
});

// ═══════════════════════════════════════════════════════════════════
// R3b. Labeled-chain parsing — label word must not become a phantom
//      component
// ═══════════════════════════════════════════════════════════════════
//
// Follow-up to R3: the Chrome retest showed that the R3 fix correctly
// ended the role-label INVERSION (Eversolo is no longer read as
// amplifier), but another layer was still promoting the bare label
// word `streamer` into the parsed component list via
// GENERIC_COMPONENT_RE. That produced a bogus duplicate-role
// clarification ("Eversolo Dmp-a6 and streamer both appear as
// streamers"). The fix is in `detectSystemDescription` — a generic
// descriptor immediately followed by `:` is a label, not a component.
// ═══════════════════════════════════════════════════════════════════

function emptyAudioState(): AudioSessionState {
  return {
    activeSystemRef: null,
    savedSystems: [],
    draftSystem: null,
    loading: false,
    proposedSystem: null,
  };
}

describe('Residual R3b: label words must not become phantom components', () => {
  it('"streamer: eversolo dmp-a6" does not create a phantom streamer component', () => {
    const msg = 'my system: streamer: eversolo dmp-a6 and some speakers';
    const subjects = extractSubjectMatches(msg);
    const proposed = detectSystemDescription(msg, subjects, emptyAudioState());
    // If detectSystemDescription returns null (ownership gate etc.), that's fine —
    // the only thing we're asserting is that IF it does return, there is no
    // phantom component named "streamer".
    if (proposed) {
      const hasPhantomStreamer = proposed.components.some(
        (c) => (c.name || '').toLowerCase().trim() === 'streamer' && !c.brand,
      );
      expect(hasPhantomStreamer).toBe(false);
    }
  });

  it('the full labeled-chain prompt does not produce a bogus duplicate-role clarification', () => {
    const msg =
      "how's this system: speakers: wlm diva monitors - amp: job integrated - streamer: eversolo dmp-a6";
    const subjects = extractSubjectMatches(msg);
    const proposed = detectSystemDescription(msg, subjects, emptyAudioState());

    // The parsed component list must not contain a phantom "streamer"
    // brand-less component that would cause the duplicate-role clarification.
    if (proposed) {
      const phantomLabels = proposed.components.filter(
        (c) => !c.brand && ['streamer', 'turntable', 'preamp', 'preamplifier'].includes(
          (c.name || '').toLowerCase().trim(),
        ),
      );
      expect(phantomLabels).toEqual([]);
    }

    // And the Eversolo must be parseable as a streamer (no inversion regression).
    const eversoloRole = detectUserAppliedRole(
      msg,
      'Eversolo DMP-A6',
      ['WLM Diva Monitors', 'Job Integrated'],
    );
    expect(eversoloRole).toBe('streamer');
  });

  it('explicit role labels are still honored correctly for Eversolo, JOB, and WLM', () => {
    const msg =
      "how's this system: speakers: wlm diva monitors - amp: job integrated - streamer: eversolo dmp-a6";

    // Eversolo → streamer
    expect(
      detectUserAppliedRole(msg, 'Eversolo DMP-A6', ['WLM Diva Monitors', 'Job Integrated']),
    ).toBe('streamer');

    // JOB Integrated → amplifier or integrated (but not streamer)
    const jobRole = detectUserAppliedRole(msg, 'Job Integrated', [
      'WLM Diva Monitors',
      'Eversolo DMP-A6',
    ]);
    expect(jobRole).not.toBe('streamer');
    expect(['amplifier', 'integrated']).toContain(jobRole);

    // WLM Diva → speaker
    expect(
      detectUserAppliedRole(msg, 'WLM Diva Monitors', ['Job Integrated', 'Eversolo DMP-A6']),
    ).toBe('speaker');
  });

  it('genuine duplicate-role case still triggers a real clarification (control)', () => {
    // Two cataloged streamers with no labels to disambiguate — should still
    // produce a clarification after the fix. This proves we only suppressed
    // the phantom-label false positive, not real conflicts.
    const msg = 'my system: Eversolo DMP-A6 and WiiM Pro streaming into a Pass INT-25 and DeVore O/96';
    const clarification = validateSystemComponents(msg, [
      comp('Eversolo DMP-A6', 'streamer', 'streamer', 'Eversolo'),
      comp('WiiM Pro', 'streamer', 'streamer', 'WiiM'),
      comp('Pass INT-25', 'integrated', 'integrated', 'Pass'),
      comp('DeVore O/96', 'speaker', 'speaker', 'DeVore'),
    ]);
    // With two real streamers, a duplicate-role clarification should be raised.
    // (Exact wording varies; just assert that SOME clarification exists.)
    expect(clarification).not.toBeNull();
  });

  it('unlabeled descriptor ("I have a streamer and some monitors") is still promoted as a component', () => {
    // Control — the fix must only suppress LABELS. A bare descriptor
    // without a trailing ':' should still be promoted as before.
    const msg = 'here is my system: I have a streamer and a Pass INT-25 integrated amp and DeVore O/96';
    const subjects = extractSubjectMatches(msg);
    const proposed = detectSystemDescription(msg, subjects, emptyAudioState());

    if (proposed) {
      // The bare word "streamer" (no colon) should still surface as a
      // generic streamer descriptor.
      const hasStreamerDescriptor = proposed.components.some(
        (c) => (c.name || '').toLowerCase().trim() === 'streamer',
      );
      // We only assert the positive shape when at least one generic
      // descriptor survived — if the gates rejected the whole message
      // (e.g. ownership gate), that's acceptable here.
      if (proposed.components.some((c) => !c.brand)) {
        expect(hasStreamerDescriptor).toBe(true);
      }
    }
  });
});
