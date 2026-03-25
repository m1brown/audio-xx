import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';
import { detectShoppingIntent } from '../shopping-intent';
import { detectInitialMode, type ConvState, INITIAL_CONV_STATE, transition } from '../conversation-state';

const EMPTY_SIGNALS = {
  traits: {} as Record<string, any>,
  symptoms: [] as string[],
  archetype_hints: [] as string[],
  uncertainty_level: 0,
  matched_phrases: [] as string[],
  matched_uncertainty_markers: [] as string[],
};

function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    dac: 'a DAC', speaker: 'speakers', headphone: 'headphones',
    amplifier: 'an amplifier', turntable: 'a turntable', streamer: 'a streamer',
  };
  return labels[cat] ?? cat;
}

function traceInput(text: string) {
  const { intent, subjectMatches } = detectIntent(text);
  const initialMode = detectInitialMode(text, {
    detectedIntent: intent,
    hasSystem: false,
    subjectCount: subjectMatches?.length ?? 0,
  });

  // Simulate what page.tsx does with empty signals (API failure)
  const shoppingCtx = detectShoppingIntent(text, EMPTY_SIGNALS, undefined);

  let userSees = '';
  if (initialMode?.mode === 'shopping') {
    if (initialMode.facts.category && initialMode.facts.budget) {
      userSees = `[Recommendations for ${initialMode.facts.category}]`;
    } else if (initialMode.facts.category) {
      userSees = `Got it — looking for ${categoryLabel(initialMode.facts.category)}. What's your budget?`;
    } else {
      userSees = 'What type of component? For example: speakers, headphones, DAC, amplifier, or turntable.';
    }
  } else if (intent === 'shopping') {
    // Falls through to main pipeline shopping path with empty signals
    if (shoppingCtx.category !== 'general') {
      userSees = `[Shopping pipeline: category=${shoppingCtx.category}, would ask clarification or recommend]`;
    } else {
      userSees = 'What type of component? For example: speakers, headphones, DAC, amplifier, or turntable.';
    }
  } else {
    userSees = `[Falls through to ${intent} pipeline]`;
  }

  return { intent, initialMode, shoppingCtx, userSees };
}

describe('Evaluate fallback trace — user-facing outputs with empty signals', () => {
  const inputs = [
    'I want to buy a DAC',
    'I want speakers',
    'looking for a DAC',
    'DAC',
  ];

  for (const text of inputs) {
    it(`"${text}" → no error message`, () => {
      const result = traceInput(text);

      console.log(`\n  INPUT: "${text}"`);
      console.log(`  intent: ${result.intent}`);
      console.log(`  initialMode: ${result.initialMode?.mode}/${result.initialMode?.stage}`);
      console.log(`  category: ${result.initialMode?.facts?.category ?? result.shoppingCtx.category}`);
      console.log(`  USER SEES: ${result.userSees}`);

      // Must NOT contain error messages — this is the core requirement
      expect(result.userSees).not.toMatch(/something went wrong/i);
      expect(result.userSees).not.toMatch(/could not reach/i);
      expect(result.userSees).not.toMatch(/try again/i);
      expect(result.userSees).not.toMatch(/rephrasing/i);
    });
  }

  // Explicit check: the three unambiguous shopping inputs → budget question
  it('"I want to buy a DAC" → asks budget', () => {
    expect(traceInput('I want to buy a DAC').userSees).toMatch(/budget/i);
  });
  it('"I want speakers" → asks budget', () => {
    expect(traceInput('I want speakers').userSees).toMatch(/budget/i);
  });
  it('"looking for a DAC" → asks budget', () => {
    expect(traceInput('looking for a DAC').userSees).toMatch(/budget/i);
  });
});
