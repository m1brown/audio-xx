/**
 * Directed mode — system-building output.
 *
 * Validates that when budget + category + taste signal are all present,
 * the shopping output shifts from exploratory options to directed
 * system-building:
 *   1. Primary direction statement (not curated-list framing)
 *   2. 1–2 anchored recommendations (not 3 equal options)
 *   3. Stronger taste-committed language
 *   4. No generic filler text
 */
import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, buildShoppingAnswer } from '../shopping-intent';
import { shoppingToAdvisory } from '../advisory-response';
import { reason } from '../reasoning';
import type { ExtractedSignals } from '../signal-types';

// ── Signals that trigger a taste profile ──────────────
// tonal_density+up AND flow+up → matches tonal_saturated archetype
const warmSignals: ExtractedSignals = {
  traits: { tonal_density: 'up', flow: 'up' } as Record<string, import('../signal-types').SignalDirection>,
  symptoms: ['warm', 'rich'],
  archetype_hints: [],
  uncertainty_level: 0,
  matched_phrases: ['warm', 'rich'],
  matched_uncertainty_markers: [],
};

const emptySignals: ExtractedSignals = {
  traits: {},
  symptoms: [],
  archetype_hints: [],
  uncertainty_level: 0,
  matched_phrases: [],
  matched_uncertainty_markers: [],
};

describe('Directed mode: budget + category + taste → directed output', () => {
  const allUserText = 'I like van halen. Looking for speakers under $5000. I prefer warm, rich sound.';

  it('sets directed = true in ShoppingAnswer when budget + category + taste all present', () => {
    const ctx = detectShoppingIntent(allUserText, warmSignals, []);
    expect(ctx.category).toBe('speaker');
    expect(ctx.budgetAmount).toBeGreaterThan(0);

    const reasoning = reason(allUserText, [], warmSignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, warmSignals, undefined, reasoning, []);

    expect(answer.directed).toBe(true);
  });

  it('caps product examples at 2 in directed mode', () => {
    const ctx = detectShoppingIntent(allUserText, warmSignals, []);
    const reasoning = reason(allUserText, [], warmSignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, warmSignals, undefined, reasoning, []);

    expect(answer.directed).toBe(true);
    expect(answer.productExamples.length).toBeLessThanOrEqual(2);
  });

  it('marks the first product as isPrimary', () => {
    const ctx = detectShoppingIntent(allUserText, warmSignals, []);
    const reasoning = reason(allUserText, [], warmSignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, warmSignals, undefined, reasoning, []);

    if (answer.productExamples.length > 0) {
      expect(answer.productExamples[0].isPrimary).toBe(true);
    }
    // Second product (if exists) should NOT be primary
    if (answer.productExamples.length > 1) {
      expect(answer.productExamples[1].isPrimary).toBeFalsy();
    }
  });

  it('uses assertive preference summary language', () => {
    const ctx = detectShoppingIntent(allUserText, warmSignals, []);
    const reasoning = reason(allUserText, [], warmSignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, warmSignals, undefined, reasoning, []);

    // Should use direct preference framing, NOT "You appear to value"
    expect(answer.preferenceSummary).toMatch(/optimizing for/i);
    expect(answer.preferenceSummary).not.toMatch(/you appear to value/i);
  });

  it('uses system-building direction language', () => {
    const ctx = detectShoppingIntent(allUserText, warmSignals, []);
    const reasoning = reason(allUserText, [], warmSignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, warmSignals, undefined, reasoning, []);

    // Should use "This system should lean toward" framing
    expect(answer.bestFitDirection).toMatch(/this system should lean toward/i);
  });

  it('suppresses refinement prompts in directed mode', () => {
    const ctx = detectShoppingIntent(allUserText, warmSignals, []);
    const reasoning = reason(allUserText, [], warmSignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, warmSignals, undefined, reasoning, []);

    // Refinement prompts should be empty or undefined
    expect(answer.refinementPrompts ?? []).toEqual([]);
  });
});

describe('Directed mode: AdvisoryResponse level', () => {
  const allUserText = 'I like van halen. Looking for speakers under $5000. I prefer warm, rich sound.';

  it('sets directed = true in AdvisoryResponse', () => {
    const ctx = detectShoppingIntent(allUserText, warmSignals, []);
    const reasoning = reason(allUserText, [], warmSignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, warmSignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, warmSignals, reasoning, {});

    expect(advisory.directed).toBe(true);
  });

  it('advisory options have isPrimary on first option', () => {
    const ctx = detectShoppingIntent(allUserText, warmSignals, []);
    const reasoning = reason(allUserText, [], warmSignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, warmSignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, warmSignals, reasoning, {});

    if (advisory.options && advisory.options.length > 0) {
      expect(advisory.options[0].isPrimary).toBe(true);
    }
  });

  it('advisory has at most 2 options in directed mode', () => {
    const ctx = detectShoppingIntent(allUserText, warmSignals, []);
    const reasoning = reason(allUserText, [], warmSignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, warmSignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, warmSignals, reasoning, {});

    expect((advisory.options ?? []).length).toBeLessThanOrEqual(2);
  });

  it('uses directed editorial intro with "should lean toward" framing', () => {
    const ctx = detectShoppingIntent(allUserText, warmSignals, []);
    const reasoning = reason(allUserText, [], warmSignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, warmSignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, warmSignals, reasoning, {});

    if (advisory.editorialIntro) {
      // Should use system-building language, not curated-list language
      expect(advisory.editorialIntro).toMatch(/should lean toward/i);
      expect(advisory.editorialIntro).not.toMatch(/below are the most/i);
    }
  });

  it('suppresses generic filler in directed mode', () => {
    const ctx = detectShoppingIntent(allUserText, warmSignals, []);
    const reasoning = reason(allUserText, [], warmSignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, warmSignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, warmSignals, reasoning, {});

    // No refinement prompts, statedGaps, or followUp in directed mode
    expect(advisory.refinementPrompts).toBeUndefined();
    expect(advisory.statedGaps).toBeUndefined();
    expect(advisory.followUp).toBeUndefined();
    expect(advisory.dependencyCaveat).toBeUndefined();
    expect(advisory.decisionFrame).toBeUndefined();
  });

  it('does NOT contain generic guidance text', () => {
    const ctx = detectShoppingIntent(allUserText, warmSignals, []);
    const reasoning = reason(allUserText, [], warmSignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, warmSignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, warmSignals, reasoning, {});

    const allText = [
      advisory.editorialIntro ?? '',
      advisory.systemInterpretation ?? '',
      advisory.followUp ?? '',
      advisory.recommendedDirection ?? '',
      ...(advisory.refinementPrompts ?? []),
      ...(advisory.statedGaps ?? []),
    ].join(' ');

    // Must not contain "For sharper recommendations" or "Tell me about your system"
    expect(allText).not.toMatch(/for sharper recommendations/i);
    expect(allText).not.toMatch(/tell me about your system/i);
  });
});

describe('Exploratory mode: NO taste signal → not directed', () => {
  const allUserText = 'Looking for speakers under $5000.';

  it('sets directed = false when taste signal is missing', () => {
    const ctx = detectShoppingIntent(allUserText, emptySignals, []);
    const reasoning = reason(allUserText, [], emptySignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, emptySignals, undefined, reasoning, []);

    expect(answer.directed).toBe(false);
  });

  it('uses exploratory language when not directed', () => {
    const ctx = detectShoppingIntent(allUserText, emptySignals, []);
    const reasoning = reason(allUserText, [], emptySignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, emptySignals, undefined, reasoning, []);

    // Should NOT use "This system should lean toward" when not directed
    expect(answer.bestFitDirection).not.toMatch(/this system should lean toward/i);
  });
});

describe('Full flow: van halen → speakers → amp category switch', () => {
  const speakerText = 'I like van halen. I want speakers under $5000. I prefer warm, rich, energetic sound.';
  const ampSwitchText = 'great - now how about an amp, too';
  const allUserText = `${speakerText}\n${ampSwitchText}`;

  it('produces directed amplifier output with injected budget', () => {
    const ctx = detectShoppingIntent(allUserText, warmSignals, [], ampSwitchText);

    // Category should be amplifier from latest message
    expect(ctx.category).toBe('amplifier');

    // Inject preserved budget (simulating page.tsx behavior)
    ctx.budgetMentioned = true;
    ctx.budgetAmount = 5000;

    const reasoning = reason(allUserText, [], warmSignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, warmSignals, undefined, reasoning, []);

    expect(answer.directed).toBe(true);
    expect(answer.productExamples.length).toBeLessThanOrEqual(2);

    const advisory = shoppingToAdvisory(answer, warmSignals, reasoning, {});
    expect(advisory.directed).toBe(true);
    expect(advisory.shoppingCategory).toBe('amplifier');

    // Should use system-building voice
    if (advisory.editorialIntro) {
      expect(advisory.editorialIntro).toMatch(/should lean toward/i);
    }

    // No generic filler
    expect(advisory.refinementPrompts).toBeUndefined();
    expect(advisory.followUp).toBeUndefined();
  });
});

describe('Next Build Step', () => {
  const speakerText = 'I like van halen. Looking for speakers under $5000. I prefer warm, rich sound.';

  it('produces next build step for speaker (from-scratch)', () => {
    const ctx = detectShoppingIntent(speakerText, warmSignals, []);
    // Not system-provided = from scratch
    expect(ctx.systemProvided).toBe(false);

    const reasoning = reason(speakerText, [], warmSignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, warmSignals, undefined, reasoning, []);

    expect(answer.directed).toBe(true);
    expect(answer.nextBuildStep).toBeDefined();
    expect(answer.nextBuildStep).toMatch(/amplifier/i);
  });

  it('produces next build step for amplifier (from-scratch)', () => {
    const ampText = 'I like jazz. Looking for an amplifier under $3000. I prefer smooth, warm sound.';
    const ctx = detectShoppingIntent(ampText, warmSignals, []);

    const reasoning = reason(ampText, [], warmSignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, warmSignals, undefined, reasoning, []);

    expect(answer.directed).toBe(true);
    expect(answer.nextBuildStep).toBeDefined();
    expect(answer.nextBuildStep).toMatch(/DAC|source/i);
  });

  it('suppresses next build step when system is provided', () => {
    const sysText = 'My system is Hegel H190 and Bluesound Node. Looking for speakers under $5000. I prefer warm sound.';
    const ctx = detectShoppingIntent(sysText, warmSignals, []);
    // System IS provided (via "my system" keyword)
    expect(ctx.systemProvided).toBe(true);

    const reasoning = reason(sysText, [], warmSignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, warmSignals, undefined, reasoning, []);

    expect(answer.nextBuildStep).toBeUndefined();
  });

  it('wires nextBuildStep to AdvisoryResponse', () => {
    const ctx = detectShoppingIntent(speakerText, warmSignals, []);
    const reasoning = reason(speakerText, [], warmSignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, warmSignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, warmSignals, reasoning, {});

    expect(advisory.nextBuildStep).toBeDefined();
    expect(advisory.nextBuildStep).toMatch(/amplifier/i);
  });
});

// ── Validation scenario sample output (printed, not asserted) ──
// These produce human-readable output for manual review.

describe('Validation scenario outputs', () => {
  it('Scenario 1: van halen → speakers → $5000 (from scratch)', () => {
    const text = 'i like van halen. I want speakers. Starting from scratch. $5000. I prefer energetic, punchy sound.';
    const energySignals: ExtractedSignals = {
      traits: { dynamics: 'up', elasticity: 'up' } as Record<string, import('../signal-types').SignalDirection>,
      symptoms: ['punchy', 'energetic'],
      archetype_hints: [],
      uncertainty_level: 0,
      matched_phrases: ['punchy', 'energetic'],
      matched_uncertainty_markers: [],
    };

    const ctx = detectShoppingIntent(text, energySignals, []);
    const reasoning = reason(text, [], energySignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, energySignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, energySignals, reasoning, {});

    console.log('\n=== SCENARIO 1: van halen → speakers → $5000 ===');
    console.log('directed:', advisory.directed);
    console.log('editorialIntro:', advisory.editorialIntro ?? '(none)');
    console.log('systemInterpretation:', advisory.systemInterpretation ?? '(none)');
    console.log('recommendedDirection:', advisory.recommendedDirection ?? '(none)');
    console.log('options count:', advisory.options?.length ?? 0);
    if (advisory.options) {
      for (const opt of advisory.options) {
        console.log(`  ${opt.isPrimary ? '★ PRIMARY' : '  secondary'}: ${opt.brand} ${opt.name} ($${opt.price})`);
        console.log(`    fitNote: ${opt.fitNote}`);
      }
    }
    console.log('nextBuildStep:', advisory.nextBuildStep ?? '(none)');
    console.log('refinementPrompts:', advisory.refinementPrompts ?? '(none)');
    console.log('followUp:', advisory.followUp ?? '(none)');
    console.log('=== END ===\n');

    expect(advisory.directed).toBe(true);
    expect((advisory.options ?? []).length).toBeLessThanOrEqual(2);
  });

  it('Scenario 2: category switch → amp (after speakers)', () => {
    const speakerHistory = 'i like van halen. I want speakers. Starting from scratch. $5000. I prefer energetic, punchy sound.';
    const ampSwitch = 'great - now how about an amp, too';
    const allText = `${speakerHistory}\n${ampSwitch}`;
    const energySignals: ExtractedSignals = {
      traits: { dynamics: 'up', elasticity: 'up' } as Record<string, import('../signal-types').SignalDirection>,
      symptoms: ['punchy', 'energetic'],
      archetype_hints: [],
      uncertainty_level: 0,
      matched_phrases: ['punchy', 'energetic'],
      matched_uncertainty_markers: [],
    };

    const ctx = detectShoppingIntent(allText, energySignals, [], ampSwitch);
    ctx.budgetMentioned = true;
    ctx.budgetAmount = 5000;

    const reasoning = reason(allText, [], energySignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, energySignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, energySignals, reasoning, {});

    console.log('\n=== SCENARIO 2: category switch → amp ===');
    console.log('directed:', advisory.directed);
    console.log('shoppingCategory:', advisory.shoppingCategory);
    console.log('editorialIntro:', advisory.editorialIntro ?? '(none)');
    console.log('systemInterpretation:', advisory.systemInterpretation ?? '(none)');
    console.log('recommendedDirection:', advisory.recommendedDirection ?? '(none)');
    console.log('options count:', advisory.options?.length ?? 0);
    if (advisory.options) {
      for (const opt of advisory.options) {
        console.log(`  ${opt.isPrimary ? '★ PRIMARY' : '  secondary'}: ${opt.brand} ${opt.name} ($${opt.price})`);
        console.log(`    fitNote: ${opt.fitNote}`);
      }
    }
    console.log('nextBuildStep:', advisory.nextBuildStep ?? '(none)');
    console.log('refinementPrompts:', advisory.refinementPrompts ?? '(none)');
    console.log('followUp:', advisory.followUp ?? '(none)');
    console.log('=== END ===\n');

    expect(advisory.directed).toBe(true);
    expect(advisory.shoppingCategory).toBe('amplifier');
    expect((advisory.options ?? []).length).toBeLessThanOrEqual(2);
  });

  it('Scenario 3: "I want a DAC" (weak taste → Start Here)', () => {
    const text = 'I want a DAC';

    const ctx = detectShoppingIntent(text, emptySignals, []);
    const reasoning = reason(text, [], emptySignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, emptySignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, emptySignals, reasoning, {});

    console.log('\n=== SCENARIO 3: "I want a DAC" (weak taste) ===');
    console.log('directed:', advisory.directed);
    console.log('lowPreferenceSignal:', advisory.lowPreferenceSignal);
    console.log('editorialIntro:', advisory.editorialIntro ?? '(none)');
    console.log('options count:', advisory.options?.length ?? 0);
    console.log('refinementPrompts:', advisory.refinementPrompts ?? '(none)');
    console.log('=== END ===\n');

    // Should NOT be directed (no taste signal)
    expect(advisory.directed).toBeFalsy();
    // Should show lowPreferenceSignal for Start Here
    expect(advisory.lowPreferenceSignal).toBe(true);
  });
});
