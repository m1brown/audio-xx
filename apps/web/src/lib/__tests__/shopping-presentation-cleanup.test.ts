/**
 * Presentation-layer cleanup tests (Phase 6).
 *
 * Targets four visible issues from Transcript A turn 4 ("give me specific
 * DAC ideas under $2000" with saved system: WLM Diva Monitor → Job
 * Integrated → Chord Hugo; preference: harmonic richness, flow, tonal
 * density):
 *
 *   1. No internal-label leakage in shopping prose
 *      (e.g. "warmth_richness", "improvement", "sweetness_flow").
 *   2. Replacement framing when the saved system already contains a DAC.
 *   3. No "active issue" overstatement when preference-direction tokens
 *      are the only "symptoms" — the system review identified no clear
 *      bottleneck, so we must not contradict it.
 *   4. Lead-pick credibility — a pure-DAC ask should not lead with a
 *      DAC/headphone-amp hybrid when a pure-DAC alternative exists.
 *
 * These tests exercise shoppingToAdvisory() with controlled fixtures —
 * no network, no engine, just the presentation-layer adapter.
 */
import { describe, it, expect } from 'vitest';
import { shoppingToAdvisory } from '../advisory-response';
import type {
  ShoppingAnswer,
  ShoppingAdvisoryContext,
  ProductExample,
} from '../shopping-intent';
import type { ExtractedSignals } from '../signal-types';
import type { ReasoningResult } from '../reasoning';

// ── Fixtures ─────────────────────────────────────────

const SAVED_SYSTEM: string[] = [
  'WLM Diva Monitor',
  'Job Integrated',
  'Chord Hugo',
];

function makeContext(): ShoppingAdvisoryContext {
  return {
    systemComponents: SAVED_SYSTEM,
    systemTendencies: 'fast, neutral-resolving with good transient control',
  } as ShoppingAdvisoryContext;
}

/** Reasoning block that mirrors Transcript A turn 4 — flow/tonal taste,
 *  tasteLabel populated, archetype set so we hit the directed path. */
function makeReasoning(): ReasoningResult {
  return {
    taste: {
      archetype: 'flow_organic',
      tasteLabel: 'harmonic richness, flow, tonal density',
      desires: [],
    },
    system: {
      profile: {
        tubeAmplification: false,
        lowPowerContext: false,
        outputType: 'speakers',
      },
    },
    direction: {
      statement: 'Move toward warmer harmonic density without slowing the presentation',
      preserve: ['speed', 'transparency'],
      arrows: [],
    },
  } as unknown as ReasoningResult;
}

/** Signals containing ONLY preference-direction tokens — no actual
 *  diagnostic symptoms. If the presentation layer treats these as
 *  "active issues" it will overstate confidence. */
function makePreferenceOnlySignals(): ExtractedSignals {
  return {
    symptoms: ['warmth_richness', 'improvement'],
    traits: { warmth: 'up', tonal_density: 'up', flow: 'up' },
    matched_phrases: ['harmonic richness', 'flow', 'tonal density'],
    archetype_hints: ['flow_organic'],
    uncertainty_level: 0,
    matched_uncertainty_markers: [],
  } as unknown as ExtractedSignals;
}

/** Signals with a real diagnostic symptom — the impact layer SHOULD
 *  promote this to "system-level" with the softened copy. */
function makeDiagnosticSignals(): ExtractedSignals {
  return {
    symptoms: ['brightness_harshness'],
    traits: { warmth: 'up' },
    matched_phrases: ['too bright'],
    archetype_hints: [],
    uncertainty_level: 0,
    matched_uncertainty_markers: [],
  } as unknown as ExtractedSignals;
}

function pureDacExample(over: Partial<ProductExample> = {}): ProductExample {
  return {
    name: 'Pontus II',
    brand: 'Denafrips',
    price: 1800,
    fitNote: 'Dense R2R tonality with strong flow.',
    character: 'R2R ladder DAC with harmonic density and natural tone.',
    catalogArchitecture: 'R-2R ladder, discrete resistor network',
    productType: 'DAC',
    pickRole: 'anchor',
    isPrimary: false,
    standoutFeatures: ['Discrete R2R ladder', 'Naturally dense tone'],
    ...over,
  } as ProductExample;
}

function hybridExample(over: Partial<ProductExample> = {}): ProductExample {
  return {
    name: 'EF400',
    brand: 'FiiO',
    price: 499,
    fitNote: 'All-in-one DAC + headphone amp.',
    character: 'Desktop DAC/headphone amplifier with balanced output.',
    catalogArchitecture: 'R-2R DAC with headphone amplifier, balanced output',
    productType: 'DAC / headphone amp',
    pickRole: 'top_pick',
    isPrimary: true,
    standoutFeatures: ['Built-in headphone amplifier', 'Balanced 4.4mm output'],
    ...over,
  } as ProductExample;
}

function makeAnswer(products: ProductExample[], directed = true): ShoppingAnswer {
  return {
    category: 'dac',
    budget: 2000,
    preferenceSummary: 'harmonic richness, flow, tonal density',
    bestFitDirection: 'R2R / discrete ladder designs with dense tone',
    whyThisFits: ['Aligns with harmonic density and flow'],
    productExamples: products,
    watchFor: [],
    directed,
  } as unknown as ShoppingAnswer;
}

// ── 1. Internal-label leakage ─────────────────────────

describe('no internal-label leakage in shopping prose', () => {
  const answer = makeAnswer([pureDacExample()]);
  const advisory = shoppingToAdvisory(
    answer,
    makePreferenceOnlySignals(),
    makeReasoning(),
    makeContext(),
    null,
  );

  /** Collect every user-facing string that the panel would render. */
  const allProse = [
    advisory.editorialIntro,
    advisory.systemInterpretation,
    advisory.systemContextPreamble,
    advisory.categoryPreamble,
    advisory.systemFitExplanation,
    advisory.expectedImpact?.explanation,
    advisory.expectedImpact?.label,
    advisory.recommendedDirection,
    ...(advisory.whyThisFits ?? []),
    ...(advisory.tradeOffs ?? []),
  ]
    .filter((v): v is string => typeof v === 'string')
    .join('\n');

  it('does not render raw symptom token "warmth_richness"', () => {
    expect(allProse).not.toMatch(/warmth_richness/);
  });

  it('does not render raw symptom token "improvement"', () => {
    // Guard against the specific snake_case token only — the word "improvement"
    // may still appear in legitimate prose, but not as a standalone symptom
    // label inside the "Your system is showing …" sentence.
    expect(advisory.systemFitExplanation ?? '').not.toMatch(
      /\bimprovement\b/,
    );
    expect(advisory.systemFitExplanation ?? '').not.toMatch(
      /\bwarmth_richness\b/,
    );
  });

  it('does not render any snake_case preference-direction token in the system-fit sentence', () => {
    // Covers the whole family: sweetness_flow, musical_organic, airy_open,
    // smooth_relaxed, dynamic_punchy, speed_transient_attack, exciting_engaging,
    // controlled_precise, detail_revealing, regression, improvement.
    const fit = advisory.systemFitExplanation ?? '';
    expect(fit).not.toMatch(
      /\b(warmth_richness|sweetness_flow|musical_organic|airy_open|smooth_relaxed|dynamic_punchy|speed_transient_attack|exciting_engaging|controlled_precise|detail_revealing|regression|improvement)\b/,
    );
  });
});

// ── 2. Replacement framing when system already contains a DAC ──

describe('replacement framing when saved system already contains a DAC', () => {
  it('directed intro calls the shortlist an alternative/replacement direction', () => {
    const answer = makeAnswer([pureDacExample()], true);
    const advisory = shoppingToAdvisory(
      answer,
      makePreferenceOnlySignals(),
      makeReasoning(),
      makeContext(),
      null,
    );

    expect(advisory.editorialIntro).toBeDefined();
    expect(advisory.editorialIntro).toMatch(
      /alternative|replacement|replacements for/i,
    );
    // Must not imply stacking two DACs in the chain.
    expect(advisory.editorialIntro).not.toMatch(/add(?:ing)? a\s+DAC/i);
  });

  it('non-directed intro also carries the replacement clause when a DAC is present', () => {
    const answer = makeAnswer([pureDacExample()], false);
    const advisory = shoppingToAdvisory(
      answer,
      makePreferenceOnlySignals(),
      makeReasoning(),
      makeContext(),
      null,
    );

    expect(advisory.editorialIntro).toBeDefined();
    expect(advisory.editorialIntro).toMatch(
      /alternative|replacement|not additions/i,
    );
  });

  it('does NOT add the replacement clause when system has no DAC', () => {
    const answer = makeAnswer([pureDacExample()], false);
    const ctx: ShoppingAdvisoryContext = {
      systemComponents: ['WLM Diva Monitor', 'Rega Brio'],
      systemTendencies: 'neutral',
    } as ShoppingAdvisoryContext;
    const advisory = shoppingToAdvisory(
      answer,
      makePreferenceOnlySignals(),
      makeReasoning(),
      ctx,
      null,
    );
    expect(advisory.editorialIntro).toBeDefined();
    expect(advisory.editorialIntro).not.toMatch(/replacement|not additions/i);
  });
});

// ── 3. No overstatement like "active issue" ──────────

describe('impact language matches diagnostic confidence', () => {
  it('preference-only signals do NOT produce "active issue" phrasing', () => {
    const answer = makeAnswer([pureDacExample()]);
    const advisory = shoppingToAdvisory(
      answer,
      makePreferenceOnlySignals(),
      makeReasoning(),
      makeContext(),
      null,
    );

    expect(advisory.expectedImpact).toBeDefined();
    expect(advisory.expectedImpact!.explanation).not.toMatch(/active issue/i);
    // Preference-only symptoms should not unlock the system-level tier.
    expect(advisory.expectedImpact!.tier).not.toBe('system-level');
  });

  it('genuine diagnostic symptoms DO promote to system-level with softened copy', () => {
    const answer = makeAnswer([pureDacExample()]);
    const advisory = shoppingToAdvisory(
      answer,
      makeDiagnosticSignals(),
      makeReasoning(),
      makeContext(),
      null,
    );

    expect(advisory.expectedImpact!.tier).toBe('system-level');
    // "active issue" replaced with softer "pushing against" framing.
    expect(advisory.expectedImpact!.explanation).not.toMatch(/active issue/i);
    expect(advisory.expectedImpact!.explanation).toMatch(
      /pushing against|audible/i,
    );
  });
});

// ── 4. Lead-pick credibility ─────────────────────────

describe('lead-pick credibility for pure-DAC asks', () => {
  it('demotes a DAC/headphone-amp hybrid when a pure-DAC alternative exists', () => {
    const answer = makeAnswer(
      [
        // Hybrid originally tagged as primary
        hybridExample({ isPrimary: true }),
        pureDacExample({ isPrimary: false }),
      ],
      true,
    );

    const advisory = shoppingToAdvisory(
      answer,
      makePreferenceOnlySignals(),
      makeReasoning(),
      makeContext(),
      null,
    );

    expect(advisory.options).toBeDefined();
    expect(advisory.options!.length).toBe(2);
    // Lead pick must be the pure DAC.
    expect(advisory.options![0].name).toBe('Pontus II');
    expect(advisory.options![0].isPrimary).toBe(true);
    // Hybrid is still in the list, but not primary.
    expect(advisory.options![1].name).toBe('EF400');
    expect(advisory.options![1].isPrimary).toBe(false);
  });

  it('leaves hybrid as lead when every option is a hybrid (nothing pure to promote)', () => {
    const answer = makeAnswer(
      [
        hybridExample({ name: 'EF400', brand: 'FiiO', isPrimary: true }),
        hybridExample({
          name: 'K9 Pro',
          brand: 'FiiO',
          catalogArchitecture: 'ESS DAC with headphone amplifier',
          isPrimary: false,
        }),
      ],
      true,
    );

    const advisory = shoppingToAdvisory(
      answer,
      makePreferenceOnlySignals(),
      makeReasoning(),
      makeContext(),
      null,
    );

    expect(advisory.options![0].name).toBe('EF400');
  });

  it('does not reorder for non-DAC asks', () => {
    const answer: ShoppingAnswer = {
      ...makeAnswer([
        hybridExample({ isPrimary: true }),
        pureDacExample({ isPrimary: false }),
      ]),
      category: 'amplifier',
    } as ShoppingAnswer;

    const advisory = shoppingToAdvisory(
      answer,
      makePreferenceOnlySignals(),
      makeReasoning(),
      makeContext(),
      null,
    );

    // Not a DAC ask — guardrail must not touch the order.
    expect(advisory.options![0].name).toBe('EF400');
  });

  it('shortlist remains directionally aligned with warmth / flow / tonal density', () => {
    // All three picks align with the stated preference — none would be
    // an awkward lead for "harmonic richness, flow, tonal density".
    const aligned: ProductExample[] = [
      pureDacExample({ name: 'Pontus II', brand: 'Denafrips' }),
      pureDacExample({
        name: 'Ares II',
        brand: 'Denafrips',
        catalogArchitecture: 'R-2R ladder',
        character: 'Warmer R2R tonal balance, ease over sharpness.',
      }),
      pureDacExample({
        name: 'Bifrost 2/64',
        brand: 'Schiit',
        catalogArchitecture: 'Multibit DAC',
        character: 'Musical multibit tonal weight.',
      }),
    ];
    const answer = makeAnswer(aligned, true);
    const advisory = shoppingToAdvisory(
      answer,
      makePreferenceOnlySignals(),
      makeReasoning(),
      makeContext(),
      null,
    );

    expect(advisory.options).toHaveLength(3);
    // Every pick's architecture signals R2R/multibit — the "flow / tonal
    // density" family. No hybrid/AIO designs sneak in.
    for (const opt of advisory.options!) {
      const arch = (opt.catalogArchitecture ?? '').toLowerCase();
      expect(arch).toMatch(/r-?2r|ladder|multibit/);
      expect(/headphone\s*amp|all-in-one|one-box/.test(arch)).toBe(false);
    }
  });
});
