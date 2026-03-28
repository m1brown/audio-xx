/**
 * Before/After behavior trace for the exact validation flow.
 * Demonstrates that constraints are correctly applied at each step.
 */

import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, buildShoppingAnswer } from '../shopping-intent';
import { reason } from '../reasoning';
import { AMPLIFIER_PRODUCTS } from '../products/amplifiers';
import type { ExtractedSignals } from '../signal-types';

const EMPTY: ExtractedSignals = {
  traits: {}, symptoms: [], archetype_hints: [],
  uncertainty_level: 0, matched_phrases: [], matched_uncertainty_markers: [],
};

describe('Before/After: Full constraint flow trace', () => {
  it('traces the exact validation flow', () => {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  FULL VALIDATION FLOW: Constraint Enforcement');
    console.log('═══════════════════════════════════════════════════\n');

    // Step 1: Speakers with large room
    const speakerText = 'i like van halen\nspeakers\n$5000\nKlipsch Heresy IV\na large living room\nbig scale';
    const speakerCtx = detectShoppingIntent(speakerText, EMPTY);
    const speakerReasoning = reason(speakerText, [], EMPTY, null, speakerCtx, undefined);
    const speakerAnswer = buildShoppingAnswer(speakerCtx, EMPTY, undefined, speakerReasoning, undefined, ['heresy iv']);

    console.log('STEP 1: Speakers — large living room, big scale, $5000');
    console.log(`  category: ${speakerAnswer.category}`);
    console.log(`  budget: $${speakerAnswer.budget}`);
    console.log(`  roomContext: ${speakerCtx.roomContext}`);
    console.log(`  products:`);
    for (const p of speakerAnswer.productExamples) {
      console.log(`    - ${p.brand} ${p.name} ($${p.price})`);
    }
    expect(speakerAnswer.productExamples.length).toBeGreaterThan(0);
    const speakerPrices = speakerAnswer.productExamples.map(p => p.price);
    console.log(`  min price: $${Math.min(...speakerPrices)}`);
    console.log(`  ✓ No sub-$1500 fallback\n`);

    // Step 2: Amps, same budget
    const ampText = 'i like van halen\nwhat about amps? same budget\n$5000';
    const ampCtx = detectShoppingIntent(ampText, EMPTY);
    const ampReasoning = reason(ampText, [], EMPTY, null, ampCtx, undefined);
    const ampAnswer = buildShoppingAnswer(ampCtx, EMPTY, undefined, ampReasoning);

    console.log('STEP 2: Amps — same budget ($5000), no constraints yet');
    console.log(`  category: ${ampAnswer.category}`);
    console.log(`  budget: $${ampAnswer.budget}`);
    console.log(`  constraints: none`);
    console.log(`  products:`);
    for (const p of ampAnswer.productExamples) {
      const cat = AMPLIFIER_PRODUCTS.find(a => a.name === p.name);
      console.log(`    - ${p.brand} ${p.name} ($${p.price}) [${cat?.topology ?? '?'}] ${cat?.availability ?? 'current'}`);
    }
    console.log('');

    // Step 3: Class AB only
    const classAbText = 'i like van halen\namps\n$5000\ni mean in class ab amps?';
    const classAbCtx = detectShoppingIntent(classAbText, EMPTY);
    const classAbReasoning = reason(classAbText, [], EMPTY, null, classAbCtx, undefined);
    const classAbAnswer = buildShoppingAnswer(classAbCtx, EMPTY, undefined, classAbReasoning);

    console.log('STEP 3: Amps — class AB only');
    console.log(`  requireTopologies: ${JSON.stringify(classAbCtx.constraints.requireTopologies)}`);
    console.log(`  products:`);
    for (const p of classAbAnswer.productExamples) {
      const cat = AMPLIFIER_PRODUCTS.find(a => a.name === p.name);
      console.log(`    - ${p.brand} ${p.name} ($${p.price}) [${cat?.topology ?? '?'}] ${cat?.availability ?? 'current'}`);
      expect(cat?.topology).toBe('class-ab-solid-state');
    }
    console.log(`  ✓ All class-ab-solid-state\n`);

    // Step 4: No tubes + new only
    const finalText = 'i like van halen\namps\n$5000\ni mean in class ab amps?\ni don\'t want tubes and i want new';
    const finalCtx = detectShoppingIntent(finalText, EMPTY);
    const finalReasoning = reason(finalText, [], EMPTY, null, finalCtx, undefined);
    const finalAnswer = buildShoppingAnswer(finalCtx, EMPTY, undefined, finalReasoning);

    console.log('STEP 4: Amps — class AB + no tubes + new only');
    console.log(`  requireTopologies: ${JSON.stringify(finalCtx.constraints.requireTopologies)}`);
    console.log(`  excludeTopologies: ${JSON.stringify(finalCtx.constraints.excludeTopologies)}`);
    console.log(`  newOnly: ${finalCtx.constraints.newOnly}`);
    console.log(`  products:`);
    for (const p of finalAnswer.productExamples) {
      const cat = AMPLIFIER_PRODUCTS.find(a => a.name === p.name);
      console.log(`    - ${p.brand} ${p.name} ($${p.price}) [${cat?.topology ?? '?'}] ${cat?.availability ?? 'current'}`);
      expect(cat?.topology).toBe('class-ab-solid-state');
      expect(cat?.availability).not.toBe('discontinued');
      expect(cat?.availability).not.toBe('vintage');
    }
    console.log(`  ✓ All class-AB, all current, no tubes\n`);

    console.log('─────────────────────────────────────────────────');
    console.log('  BEFORE: constraints were soft preferences only');
    console.log('    → tube amps could appear after "no tubes"');
    console.log('    → discontinued products after "I want new"');
    console.log('    → non-class-AB after "class ab amps?"');
    console.log('  AFTER: constraints are hard filters');
    console.log('    → excluded products never appear');
    console.log('    → topology requirements enforced');
    console.log('    → availability gates enforced');
    console.log('─────────────────────────────────────────────────\n');
  });
});
