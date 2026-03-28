/**
 * Validation: "I want speakers" must show START HERE block, not "balanced".
 *
 * Tests the full pipeline: intent → shopping answer → advisory response
 * to verify that weak preference signal produces:
 *   - lowPreferenceSignal: true
 *   - no "balanced presentation" in any output text
 *   - no "no strong signal" in any output text
 *   - systemInterpretation is undefined (suppressed for weak signal)
 *   - shoppingCategory is set (needed for StartHereBlock)
 */
import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, buildShoppingAnswer } from '../shopping-intent';
import { shoppingToAdvisory } from '../advisory-response';
import { reason } from '../reasoning';
import type { ExtractedSignals } from '../signal-types';

describe('START HERE validation: "I want speakers"', () => {
  const query = 'I want to buy speakers';

  // Empty signals — no taste signal provided
  const emptySignals: ExtractedSignals = {
    traits: {},
    symptoms: [],
    archetype_hints: [],
    uncertainty_level: 0,
    matched_phrases: [],
    matched_uncertainty_markers: [],
  };

  const shoppingCtx = detectShoppingIntent(query, emptySignals, []);

  it('detects shopping intent for speakers', () => {
    expect(shoppingCtx.detected).toBe(true);
    expect(shoppingCtx.category).toBe('speaker');
  });

  it('sets lowPreferenceSignal = true on advisory response', () => {
    const reasoning = reason(query, [], emptySignals, null, shoppingCtx, undefined);
    const answer = buildShoppingAnswer(shoppingCtx, emptySignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, emptySignals, reasoning, {});

    expect(advisory.lowPreferenceSignal).toBe(true);
    expect(advisory.shoppingCategory).toBeTruthy();
  });

  it('does NOT contain "balanced presentation" anywhere', () => {
    const reasoning = reason(query, [], emptySignals, null, shoppingCtx, undefined);
    const answer = buildShoppingAnswer(shoppingCtx, emptySignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, emptySignals, reasoning, {});

    // Check all text fields
    const allText = [
      advisory.systemInterpretation ?? '',
      advisory.editorialIntro ?? '',
      advisory.editorialClosing?.tasteVerdict ?? '',
      advisory.editorialClosing?.topPicks ?? '',
      advisory.followUp ?? '',
      ...(advisory.strategyBullets ?? []),
      ...(advisory.whyThisFits ?? []),
      ...(advisory.refinementPrompts ?? []),
    ].join(' ');

    expect(allText).not.toMatch(/balanced presentation/i);
  });

  it('does NOT contain "no strong signal" language', () => {
    const reasoning = reason(query, [], emptySignals, null, shoppingCtx, undefined);
    const answer = buildShoppingAnswer(shoppingCtx, emptySignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, emptySignals, reasoning, {});

    const allText = [
      advisory.systemInterpretation ?? '',
      advisory.editorialIntro ?? '',
      ...(advisory.whyThisFits ?? []),
      ...(advisory.strategyBullets ?? []),
    ].join(' ');

    expect(allText).not.toMatch(/no strong signal/i);
    expect(allText).not.toMatch(/no strong single-trait/i);
  });

  it('suppresses systemInterpretation for weak signal (no system)', () => {
    const reasoning = reason(query, [], emptySignals, null, shoppingCtx, undefined);
    const answer = buildShoppingAnswer(shoppingCtx, emptySignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, emptySignals, reasoning, {});

    // No taste signal + no system = systemInterpretation should be undefined
    // (the StartHereBlock replaces it)
    expect(advisory.systemInterpretation).toBeUndefined();
  });

  it('produces product options even with weak signal', () => {
    const reasoning = reason(query, [], emptySignals, null, shoppingCtx, undefined);
    const answer = buildShoppingAnswer(shoppingCtx, emptySignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, emptySignals, reasoning, {});

    // Products should still be shown — the user gets starting points
    expect(advisory.options).toBeDefined();
    expect(advisory.options!.length).toBeGreaterThan(0);
  });

  it('suppresses ALL passive text when preference is weak', () => {
    const reasoning = reason(query, [], emptySignals, null, shoppingCtx, undefined);
    const answer = buildShoppingAnswer(shoppingCtx, emptySignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, emptySignals, reasoning, {});

    // When lowPreferenceSignal = true, passive text is suppressed
    // EXCEPT the taste question follow-up, which bypasses suppressFiller
    // to bootstrap the next turn when confidence is low.
    expect(advisory.editorialIntro).toBeUndefined();
    expect(advisory.refinementPrompts).toBeUndefined();
    // followUp may contain the taste question — this is intentional
    expect(advisory.whyThisFits).toBeUndefined();
    expect(advisory.tradeOffs).toBeUndefined();
    expect(advisory.statedGaps).toBeUndefined();
    expect(advisory.dependencyCaveat).toBeUndefined();
    expect(advisory.provisional).toBeFalsy();
  });

  it('does NOT contain "musical engagement" in any visible text field', () => {
    const reasoning = reason(query, [], emptySignals, null, shoppingCtx, undefined);
    const answer = buildShoppingAnswer(shoppingCtx, emptySignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, emptySignals, reasoning, {});

    const allText = [
      advisory.systemInterpretation ?? '',
      advisory.editorialIntro ?? '',
      advisory.followUp ?? '',
      ...(advisory.strategyBullets ?? []),
      ...(advisory.whyThisFits ?? []),
      ...(advisory.refinementPrompts ?? []),
    ].join(' ');

    expect(allText).not.toMatch(/musical engagement/i);
  });

  it('prints advisory fields for inspection', () => {
    const reasoning = reason(query, [], emptySignals, null, shoppingCtx, undefined);
    const answer = buildShoppingAnswer(shoppingCtx, emptySignals, undefined, reasoning, []);
    const advisory = shoppingToAdvisory(answer, emptySignals, reasoning, {});

    console.log('\n=== "I want speakers" → advisory ===');
    console.log('lowPreferenceSignal:', advisory.lowPreferenceSignal);
    console.log('shoppingCategory:', advisory.shoppingCategory);
    console.log('systemInterpretation:', advisory.systemInterpretation ?? '(suppressed)');
    console.log('editorialIntro:', advisory.editorialIntro ?? '(none)');
    console.log('strategyBullets:', advisory.strategyBullets ?? '(none)');
    console.log('options count:', advisory.options?.length ?? 0);
    console.log('statedGaps:', advisory.statedGaps);
    console.log('refinementPrompts:', advisory.refinementPrompts);
    console.log('followUp:', advisory.followUp ?? '(none)');
    console.log('whyThisFits:', advisory.whyThisFits ?? '(none)');
    console.log('provisional:', advisory.provisional);
    console.log('=== END ===\n');
  });
});
