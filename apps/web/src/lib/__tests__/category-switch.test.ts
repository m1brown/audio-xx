/**
 * Category switching within shopping mode.
 *
 * Validates that when a user completes one shopping round (e.g. speakers)
 * and asks for another category ("now how about an amp"), the system:
 *   1. Detects the NEW category from the latest message
 *   2. Does NOT return the old category
 *   3. Preserves budget context via budgetAmount injection
 *   4. Produces product options for the new category
 */
import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, parseBudgetAmount } from '../shopping-intent';
import { buildShoppingAnswer } from '../shopping-intent';
import { shoppingToAdvisory } from '../advisory-response';
import { reason } from '../reasoning';
import type { ExtractedSignals } from '../signal-types';

const emptySignals: ExtractedSignals = {
  traits: {},
  symptoms: [],
  archetype_hints: [],
  uncertainty_level: 0,
  matched_phrases: [],
  matched_uncertainty_markers: [],
};

describe('Category switch: speaker → amplifier', () => {
  // Simulates allUserText after a full speaker shopping flow,
  // then user says "great - now how about an amp, too"
  const allUserText = [
    'i like van halen',
    'I want speakers',
    'starting from scratch',
    '5000',
    'great - now how about an amp, too',
  ].join('\n');

  const latestMessage = 'great - now how about an amp, too';

  it('detects amplifier as category when latestMessage is provided', () => {
    const ctx = detectShoppingIntent(allUserText, emptySignals, [], latestMessage);
    expect(ctx.category).toBe('amplifier');
  });

  it('returns general without latestMessage when no intent keywords present', () => {
    // Without latestMessage, detectShoppingIntent bails early (detected=false)
    // because none of INTENT_KEYWORDS appear in the text. The latestMessage
    // parameter bypasses this so category detection actually runs.
    const ctx = detectShoppingIntent(allUserText, emptySignals, []);
    expect(ctx.category).toBe('general');
    expect(ctx.detected).toBe(false);
  });
});

describe('Category switch: amplifier → speaker (reverse order)', () => {
  // This is the fragile case: without latestMessage, the amplifier keyword
  // in old messages would win because amplifier patterns are checked first.
  const allUserText = [
    'i like jazz',
    'I want an amplifier',
    'starting from scratch',
    '3000',
    'great - now how about speakers',
  ].join('\n');

  const latestMessage = 'great - now how about speakers';

  it('detects speaker when latestMessage is provided', () => {
    const ctx = detectShoppingIntent(allUserText, emptySignals, [], latestMessage);
    expect(ctx.category).toBe('speaker');
  });

  it('returns general without latestMessage (no intent keywords → early bail)', () => {
    const ctx = detectShoppingIntent(allUserText, emptySignals, []);
    // Without latestMessage, detected=false exits before category detection
    expect(ctx.category).toBe('general');
  });
});

describe('Category switch: DAC → headphone', () => {
  const allUserText = [
    'I want a DAC',
    'under 1000',
    'now I need headphones too',
  ].join('\n');

  const latestMessage = 'now I need headphones too';

  it('detects headphone from latest message', () => {
    const ctx = detectShoppingIntent(allUserText, emptySignals, [], latestMessage);
    expect(ctx.category).toBe('headphone');
  });
});

describe('Budget preservation on category switch', () => {
  it('parseBudgetAmount does NOT match plain "5000"', () => {
    // Confirms the problem: a standalone "5000" reply to "what is your budget?"
    // is not matched by BUDGET_AMOUNT_PATTERNS
    expect(parseBudgetAmount('5000')).toBeNull();
  });

  it('parseBudgetAmount matches "$5000"', () => {
    expect(parseBudgetAmount('$5000')).toBe(5000);
  });

  it('shopping context can be patched with preserved budget', () => {
    const allUserText = 'great - now how about an amp, too';
    const ctx = detectShoppingIntent(allUserText, emptySignals, [], allUserText);

    // No budget detected from text alone
    expect(ctx.budgetMentioned).toBe(false);
    expect(ctx.budgetAmount).toBeNull();

    // Simulate page.tsx budget injection from lastShoppingFactsRef
    const preservedBudget = '$5000';
    const amount = parseInt(preservedBudget.replace(/[$,]/g, ''), 10);
    ctx.budgetMentioned = true;
    ctx.budgetAmount = amount;

    expect(ctx.budgetMentioned).toBe(true);
    expect(ctx.budgetAmount).toBe(5000);
  });
});

describe('Full pipeline: category switch produces valid advisory', () => {
  const allUserText = [
    'i like van halen',
    'I want speakers',
    'starting from scratch',
    '5000',
    'great - now how about an amp, too',
  ].join('\n');

  const latestMessage = 'great - now how about an amp, too';

  it('produces amplifier options with injected budget', () => {
    const ctx = detectShoppingIntent(allUserText, emptySignals, [], latestMessage);

    // Inject preserved budget
    ctx.budgetMentioned = true;
    ctx.budgetAmount = 5000;

    expect(ctx.category).toBe('amplifier');

    const reasoning = reason(allUserText, [], emptySignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, emptySignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, emptySignals, reasoning, {});

    expect(advisory.options).toBeDefined();
    expect(advisory.options!.length).toBeGreaterThan(0);
    expect(advisory.shoppingCategory).toBe('amplifier');
  });

  it('does NOT contain system interrogation language', () => {
    const ctx = detectShoppingIntent(allUserText, emptySignals, [], latestMessage);
    ctx.budgetMentioned = true;
    ctx.budgetAmount = 5000;

    const reasoning = reason(allUserText, [], emptySignals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, emptySignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, emptySignals, reasoning, {});

    const allText = [
      advisory.systemInterpretation ?? '',
      advisory.editorialIntro ?? '',
      advisory.followUp ?? '',
      ...(advisory.strategyBullets ?? []),
      ...(advisory.refinementPrompts ?? []),
    ].join(' ');

    // Must not ask for system info — user said "starting from scratch"
    expect(allText).not.toMatch(/what.*(?:system|setup|chain)/i);
    expect(allText).not.toMatch(/tell me about your/i);
  });
});
