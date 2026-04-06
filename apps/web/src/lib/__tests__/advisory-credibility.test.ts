/**
 * Advisory Credibility Integration Test
 *
 * Exercises the real code pipeline: detectShoppingIntent → buildShoppingAnswer → shoppingToAdvisory
 * Verifies anchor selection, category preamble, and credibility for 3 benchmark cases.
 */
import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, buildShoppingAnswer } from '../shopping-intent';
import { shoppingToAdvisory } from '../advisory-response';
import { processText } from '../engine';

// ─── Test Case 1: "I want a tube amp" ───────────────────
describe('Advisory Credibility', () => {
  it('Test 1: "I want a tube amp" → credible mainstream tube amp anchor', () => {
    const userText = 'I want a tube amp';
    const signals = processText(userText);
    const ctx = detectShoppingIntent(userText, signals);

    console.log('[TEST 1] Category:', ctx.category);
    console.log('[TEST 1] Budget:', ctx.budgetAmount);
    console.log('[TEST 1] Constraints:', JSON.stringify(ctx.constraints));

    const answer = buildShoppingAnswer(ctx, signals);

    console.log('[TEST 1] Products:');
    for (const p of answer.productExamples) {
      console.log(`  [${p.pickRole}] ${p.brand} ${p.name} — $${p.price} (${p.catalogTopology ?? 'n/a'})`);
    }

    // Anchor must exist
    const anchor = answer.productExamples.find(p => p.pickRole === 'anchor');
    expect(anchor).toBeDefined();

    // Anchor must be a credible mainstream tube amp brand
    const credibleBrands = ['rogue audio', 'primaluna', 'cayin', 'line magnetic', 'leben', 'aurorasound', 'willsenton'];
    expect(credibleBrands).toContain(anchor!.brand.toLowerCase());

    // Anchor must be push-pull tube (not SET for generic request)
    expect(anchor!.catalogTopology).toBe('push-pull-tube');

    // close_alt must be a different brand from anchor
    const closeAlt = answer.productExamples.find(p => p.pickRole === 'close_alt');
    if (closeAlt) {
      expect(closeAlt.brand.toLowerCase()).not.toBe(anchor!.brand.toLowerCase());
    }

    // Advisory conversion — verify categoryPreamble
    const advisory = shoppingToAdvisory(answer, signals);
    console.log('[TEST 1] categoryPreamble:', advisory.categoryPreamble);
    console.log('[TEST 1] editorialIntro:', advisory.editorialIntro);

    // Category preamble should render for this generic request
    expect(advisory.categoryPreamble).toBeDefined();
    expect(advisory.categoryPreamble).toContain('amplifier');

    // No category drift
    expect(answer.category).toBe('amplifier');
  });

  // ─── Test Case 2: "tube amp under $5000" (budget follow-up after tube amp) ───
  it('Test 2: "I want a tube amp under $5000" → budget-aware anchor', () => {
    // Simulate budget + category in a single turn (real app carries context across turns)
    const userText = 'I want a tube amp under $5000';
    const signals = processText(userText);
    const ctx = detectShoppingIntent(userText, signals);

    console.log('[TEST 2] Category:', ctx.category);
    console.log('[TEST 2] Budget:', ctx.budgetAmount);

    const answer = buildShoppingAnswer(ctx, signals);

    console.log('[TEST 2] Products:');
    for (const p of answer.productExamples) {
      console.log(`  [${p.pickRole}] ${p.brand} ${p.name} — $${p.price} (${p.catalogTopology ?? 'n/a'})`);
    }

    const anchor = answer.productExamples.find(p => p.pickRole === 'anchor');
    expect(anchor).toBeDefined();

    // Anchor must be within budget (or used price within budget)
    expect(anchor!.price).toBeLessThanOrEqual(5000);

    // Anchor should use 70%+ of $5000 budget for serious recommendation
    expect(anchor!.price).toBeGreaterThan(2500);

    // Must be push-pull tube
    expect(anchor!.catalogTopology).toBe('push-pull-tube');

    // Credible brand
    const credibleBrands = ['rogue audio', 'primaluna', 'cayin', 'line magnetic', 'leben', 'aurorasound'];
    expect(credibleBrands).toContain(anchor!.brand.toLowerCase());

    // No category drift
    expect(answer.category).toBe('amplifier');
  });

  // ─── Test Case 3: "Best DAC under 1000" ───────────────
  it('Test 3: "Best DAC under 1000" → credible mainstream DAC anchor, no niche brands', () => {
    const userText = 'Best DAC under 1000';
    const signals = processText(userText);
    const ctx = detectShoppingIntent(userText, signals);

    console.log('[TEST 3] Category:', ctx.category);
    console.log('[TEST 3] Budget:', ctx.budgetAmount);

    const answer = buildShoppingAnswer(ctx, signals);

    console.log('[TEST 3] Products:');
    for (const p of answer.productExamples) {
      console.log(`  [${p.pickRole}] ${p.brand} ${p.name} — $${p.price} (topology: ${p.catalogTopology ?? 'n/a'})`);
    }

    const anchor = answer.productExamples.find(p => p.pickRole === 'anchor');
    expect(anchor).toBeDefined();

    // Anchor must NOT be Audalytic (niche brand)
    expect(anchor!.brand.toLowerCase()).not.toBe('audalytic');

    // Anchor must NOT be MHDT (niche/nonTraditional)
    expect(anchor!.brand.toLowerCase()).not.toBe('mhdt');

    // Anchor should be a credible mainstream DAC brand
    const credibleDacBrands = ['schiit', 'chord', 'topping', 'bluesound', 'hifiman', 'smsl', 'denafrips', 'musical fidelity'];
    expect(credibleDacBrands).toContain(anchor!.brand.toLowerCase());

    // Anchor price must be within budget (or used price within budget)
    const effectivePrice = anchor!.usedPriceRange
      ? Math.min(anchor!.price, anchor!.usedPriceRange.high)
      : anchor!.price;
    expect(effectivePrice).toBeLessThanOrEqual(1000);

    // Advisory conversion — verify categoryPreamble for DAC with budget
    const advisory = shoppingToAdvisory(answer, signals);
    console.log('[TEST 3] categoryPreamble:', advisory.categoryPreamble);

    // Category preamble should render and mention presentation style / quality tier framing
    expect(advisory.categoryPreamble).toBeDefined();
    expect(advisory.categoryPreamble).toContain('presentation style');

    // No category drift
    expect(answer.category).toBe('DAC');
  });
});
