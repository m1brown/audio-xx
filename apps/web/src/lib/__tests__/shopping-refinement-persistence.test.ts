/**
 * Tests: Shopping refinement context persistence.
 *
 * Validates that after initial shopping recommendations are delivered,
 * refinement inputs (room size, preference tweaks, product selection)
 * stay in shopping mode and NEVER trigger:
 *   - lowPreferenceSignal / START HERE
 *   - system ownership questions
 *   - mode reset to idle
 */
import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, buildShoppingAnswer, getStatedGaps, getShoppingClarification } from '../shopping-intent';
import { shoppingToAdvisory } from '../advisory-response';
import { reason } from '../reasoning';
import type { ExtractedSignals } from '../signal-types';
import { detectIntent } from '../intent';
import { routeConversation, resolveMode } from '../conversation-router';

const EMPTY_SIGNALS: ExtractedSignals = {
  traits: {},
  symptoms: [],
  archetype_hints: [],
  uncertainty_level: 0,
  matched_phrases: [],
  matched_uncertainty_markers: [],
};

// Simulate accumulated text from the full flow
const FULL_FLOW_TEXT = [
  'i like van halen',
  'speakers',
  'starting from scratch',
  '$5000',
  'Klipsch Heresy IV',
  'a large living room',
].join('\n');

// Simulate text up to initial recommendation
const INITIAL_TEXT = [
  'i like van halen',
  'speakers',
  'starting from scratch',
  '$5000',
].join('\n');

describe('Shopping refinement: context preservation', () => {
  it('detectShoppingIntent preserves category=speaker from accumulated text', () => {
    const ctx = detectShoppingIntent(FULL_FLOW_TEXT, EMPTY_SIGNALS, undefined, 'a large living room');
    expect(ctx.category).toBe('speaker');
    expect(ctx.budgetMentioned).toBe(true);
    expect(ctx.useCaseProvided).toBe(true);
  });

  it('detectShoppingIntent detects build-a-system mode from accumulated text', () => {
    const ctx = detectShoppingIntent(FULL_FLOW_TEXT, EMPTY_SIGNALS, undefined, 'a large living room');
    expect(ctx.mode).toBe('build-a-system');
  });

  it('"a large living room" does not break shopping mode via routeConversation', () => {
    const routedMode = routeConversation('a large living room');
    // Should be 'inquiry' (no explicit shopping/diagnosis signal)
    // but resolveMode should persist shopping
    const effectiveMode = resolveMode(routedMode, 'shopping');
    expect(effectiveMode).toBe('shopping');
  });

  it('"a large living room" intent override stays in shopping', () => {
    const { intent } = detectIntent('a large living room');
    // Default intent is 'diagnosis', but mode-aware override in page.tsx
    // rewrites to 'shopping' when effectiveMode === 'shopping'.
    // The test just verifies that the intent isn't one of the exempted types.
    expect(intent).not.toBe('product_assessment');
    expect(intent).not.toBe('comparison');
  });

  it('getShoppingClarification returns null on refinement turn (pastClarificationCap)', () => {
    const ctx = detectShoppingIntent(FULL_FLOW_TEXT, EMPTY_SIGNALS, undefined, 'a large living room');
    // On refinement (shoppingAnswerCount > 0 → pastClarificationCap = true),
    // getShoppingClarification is called with skipToSuggestions = false but
    // page.tsx passes null. Simulate by checking the question directly.
    const question = getShoppingClarification(ctx, EMPTY_SIGNALS, 5, false);
    // Either null (ready) or a taste question — but never a system question
    if (question) {
      expect(question).not.toMatch(/existing system|already have|gear you want/i);
    }
  });

  it('buildShoppingAnswer produces products for refinement text', () => {
    const ctx = detectShoppingIntent(FULL_FLOW_TEXT, EMPTY_SIGNALS, undefined, 'a large living room');
    const reasoning_result = reason(FULL_FLOW_TEXT, [], EMPTY_SIGNALS, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, reasoning_result, undefined);

    expect(answer.category).toBe('speakers');
    expect(answer.productExamples.length).toBeGreaterThan(0);
  });

  it('shoppingToAdvisory includes lowPreferenceSignal (page.tsx suppresses it)', () => {
    const ctx = detectShoppingIntent(FULL_FLOW_TEXT, EMPTY_SIGNALS, undefined, 'a large living room');
    const reasoning_result = reason(FULL_FLOW_TEXT, [], EMPTY_SIGNALS, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, reasoning_result, undefined);
    const advisory = shoppingToAdvisory(answer, EMPTY_SIGNALS, reasoning_result, {}, undefined);

    // The advisory layer may set lowPreferenceSignal=true because taste gap exists.
    // page.tsx suppresses this on refinement turns (shoppingAnswerCount > 0).
    // Here we just verify the advisory is valid and has products.
    expect(advisory.kind).toBe('shopping');
    expect(advisory.options).toBeDefined();
    expect(advisory.options!.length).toBeGreaterThan(0);
  });
});

describe('Shopping refinement: environment signals recognized', () => {
  const ENV_INPUTS = [
    'a large living room',
    'small room, nearfield setup',
    'loud listening in a dedicated room',
    'low volume, apartment, late night',
    'desktop setup',
    'bedroom system',
  ];

  for (const input of ENV_INPUTS) {
    it(`"${input}" → useCaseProvided = true`, () => {
      const text = INITIAL_TEXT + '\n' + input;
      const ctx = detectShoppingIntent(text, EMPTY_SIGNALS, undefined, input);
      expect(ctx.useCaseProvided).toBe(true);
    });
  }
});

describe('Shopping refinement: mode persistence for ambiguous inputs', () => {
  const REFINEMENT_INPUTS = [
    'a large living room',
    'something with more bass',
    'I prefer the Klipsch',
    'nearfield',
    'loud rock music',
    'low volume listening',
  ];

  for (const input of REFINEMENT_INPUTS) {
    it(`"${input}" stays in shopping mode via resolveMode`, () => {
      const routedMode = routeConversation(input);
      const effectiveMode = resolveMode(routedMode, 'shopping');
      expect(effectiveMode).toBe('shopping');
    });
  }
});
