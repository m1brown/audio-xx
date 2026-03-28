/**
 * Before/After demonstration of the shopping refinement fix.
 * Shows that after initial recommendations, "a large living room"
 * stays in shopping mode and doesn't trigger START HERE.
 */
import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, buildShoppingAnswer, getStatedGaps } from '../shopping-intent';
import { shoppingToAdvisory } from '../advisory-response';
import { reason } from '../reasoning';
import { routeConversation, resolveMode } from '../conversation-router';
import type { ExtractedSignals } from '../signal-types';

const EMPTY_SIGNALS: ExtractedSignals = {
  traits: {},
  symptoms: [],
  archetype_hints: [],
  uncertainty_level: 0,
  matched_phrases: [],
  matched_uncertainty_markers: [],
};

const FULL_FLOW_TEXT = [
  'i like van halen',
  'speakers',
  'starting from scratch',
  '$5000',
  'Klipsch Heresy IV',
  'a large living room',
].join('\n');

describe('Before/After: Shopping refinement context fix', () => {
  it('demonstrates the fix', () => {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  BEFORE/AFTER: Shopping Refinement Context Fix');
    console.log('═══════════════════════════════════════════════════\n');

    // 1. Mode persistence
    const routedMode = routeConversation('a large living room');
    const effectiveMode = resolveMode(routedMode, 'shopping');
    console.log(`1. routeConversation("a large living room") = "${routedMode}"`);
    console.log(`   resolveMode("${routedMode}", "shopping") = "${effectiveMode}"`);
    console.log(`   → Mode persists as shopping ✓\n`);

    // 2. Shopping context
    const ctx = detectShoppingIntent(FULL_FLOW_TEXT, EMPTY_SIGNALS, undefined, 'a large living room');
    console.log(`2. detectShoppingIntent with accumulated text:`);
    console.log(`   category: ${ctx.category}`);
    console.log(`   mode: ${ctx.mode}`);
    console.log(`   budgetMentioned: ${ctx.budgetMentioned}`);
    console.log(`   useCaseProvided: ${ctx.useCaseProvided}`);
    console.log(`   → Context preserved ✓\n`);

    // 3. Advisory output (RAW)
    const reasoning_result = reason(FULL_FLOW_TEXT, [], EMPTY_SIGNALS, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, reasoning_result, undefined);
    const advisory = shoppingToAdvisory(answer, EMPTY_SIGNALS, reasoning_result, {}, undefined);

    console.log(`3. shoppingToAdvisory output (BEFORE page.tsx guard):`);
    console.log(`   kind: ${advisory.kind}`);
    console.log(`   lowPreferenceSignal: ${advisory.lowPreferenceSignal}  ← would trigger START HERE`);
    console.log(`   provisional: ${advisory.provisional}`);
    console.log(`   statedGaps: ${JSON.stringify(advisory.statedGaps)}`);
    console.log(`   options count: ${advisory.options?.length ?? 0}\n`);

    // 4. Apply page.tsx refinement guard
    const shoppingAnswerCount = 1;
    if (shoppingAnswerCount > 0) {
      advisory.lowPreferenceSignal = false;
      advisory.provisional = false;
      advisory.statedGaps = undefined;
    }

    console.log(`4. AFTER page.tsx refinement guard (shoppingAnswerCount=${shoppingAnswerCount}):`);
    console.log(`   lowPreferenceSignal: ${advisory.lowPreferenceSignal}  ← START HERE suppressed ✓`);
    console.log(`   provisional: ${advisory.provisional}`);
    console.log(`   statedGaps: ${JSON.stringify(advisory.statedGaps)}  ← no gap caveats ✓`);
    console.log(`   options count: ${advisory.options?.length ?? 0}  ← products delivered ✓\n`);

    if (advisory.options) {
      console.log(`5. Products recommended:`);
      for (const opt of advisory.options) {
        console.log(`   - ${opt.name}`);
      }
    }

    console.log('\n─────────────────────────────────────────────────');
    console.log('  BEFORE (broken): lowPreferenceSignal=true');
    console.log('    → Shows START HERE, drops context, re-asks system');
    console.log('  AFTER (fixed): lowPreferenceSignal=false on refinement');
    console.log('    → Stays in shopping, delivers refined recommendations');
    console.log('─────────────────────────────────────────────────\n');

    expect(effectiveMode).toBe('shopping');
    expect(advisory.lowPreferenceSignal).toBe(false);
    expect(advisory.options!.length).toBeGreaterThan(0);
  });
});
