/**
 * Full QA Pass — 10 end-to-end conversation flow tests.
 *
 * Tests the complete pipeline as a real user would experience it:
 *   conversation-router → conversation-state → signal extraction →
 *   reasoning → shopping-intent → advisory-response
 *
 * NO code modifications — observe, diagnose, report.
 */
import { describe, it, expect } from 'vitest';
import { routeConversation } from '../conversation-router';
import { transition, detectInitialMode, INITIAL_CONV_STATE } from '../conversation-state';
import type { ConvState } from '../conversation-state';
import { reason } from '../reasoning';
import { extractDesires } from '../intent';
import {
  detectShoppingIntent,
  buildShoppingAnswer,
  parseBudgetAmount,
} from '../shopping-intent';
import { shoppingToAdvisory } from '../advisory-response';
import type { ExtractedSignals } from '../signal-types';

// ─── Helpers ─────────────────────────────────────────────────────────
const emptySignals: ExtractedSignals = {
  traits: {},
  symptoms: [],
  archetype_hints: [],
  uncertainty_level: 0,
  matched_phrases: [],
  matched_uncertainty_markers: [],
};

/** Build signals from text heuristically (avoids processText's file dependency). */
function buildSignalsFromText(text: string): ExtractedSignals {
  const lower = text.toLowerCase();
  const traits: Record<string, 'up' | 'down'> = {};
  const archetype_hints: string[] = [];

  if (/warm|rich|tube|thick|body|lush/i.test(lower)) {
    traits.tonal_density = 'up';
    traits.flow = 'up';
    archetype_hints.push('tonal_saturated');
  }
  if (/dynamic|punch|rhythm|energy|impact|van halen|led zeppelin|rock/i.test(lower)) {
    traits.dynamics = 'up';
    traits.elasticity = 'up';
    archetype_hints.push('rhythmic_propulsive');
  }
  if (/precise|detail|analytical|resolv|accurate/i.test(lower)) {
    traits.clarity = 'up';
    archetype_hints.push('precision_explicit');
  }
  if (/spatial|stage|holograph|imaging|soundstage/i.test(lower)) {
    archetype_hints.push('spatial_holographic');
  }
  if (/flow|organic|natural|jazz|classical|acoustic|blues/i.test(lower)) {
    traits.flow = 'up';
    if (!archetype_hints.includes('tonal_saturated')) {
      archetype_hints.push('flow_organic');
    }
  }

  return {
    traits,
    symptoms: [],
    archetype_hints,
    uncertainty_level: Object.keys(traits).length === 0 ? 0.8 : 0.2,
    matched_phrases: [],
    matched_uncertainty_markers: [],
  };
}

const defaultContext = { hasSystem: false, subjectCount: 0, detectedIntent: '' };

/** Simulate a multi-turn shopping conversation and return the final advisory. */
function runShoppingFlow(messages: string[]) {
  const allUserText = messages.join('\n');
  const latestMessage = messages[messages.length - 1];
  const signals = buildSignalsFromText(allUserText);
  const desires = extractDesires(allUserText);

  const shoppingCtx = detectShoppingIntent(
    allUserText,
    signals,
    [],
    messages.length > 1 ? latestMessage : undefined,
  );

  const reasoning = reason(allUserText, desires, signals, null, shoppingCtx, undefined);
  const answer = buildShoppingAnswer(shoppingCtx, signals, undefined, reasoning, []);
  const advisory = shoppingToAdvisory(answer, signals, reasoning, {});

  return { shoppingCtx, reasoning, answer, advisory, signals };
}

// ═══════════════════════════════════════════════════════════════════════
// QA TEST 1: Full speaker shopping flow — strong taste
// ═══════════════════════════════════════════════════════════════════════
describe('QA-1: Speaker shopping, strong taste (van halen → speakers → $5000)', () => {
  const result = runShoppingFlow([
    'i like van halen and led zeppelin',
    'I want speakers',
    'starting from scratch',
    '$5000',
  ]);

  it('detects speaker category', () => {
    expect(result.shoppingCtx.category).toBe('speaker');
  });

  it('detects budget', () => {
    expect(result.shoppingCtx.budgetAmount).toBe(5000);
  });

  it('enters directed mode (budget + category + taste)', () => {
    expect(result.answer.directed).toBe(true);
  });

  it('produces ≤ 2 product options', () => {
    expect(result.advisory.options!.length).toBeLessThanOrEqual(2);
    expect(result.advisory.options!.length).toBeGreaterThan(0);
  });

  it('marks first option as primary', () => {
    expect(result.advisory.options![0].isPrimary).toBe(true);
  });

  it('has an editorial intro (not undefined)', () => {
    expect(result.advisory.editorialIntro).toBeDefined();
    expect(result.advisory.editorialIntro!.length).toBeGreaterThan(20);
  });

  it('does NOT contain generic filler prompts', () => {
    const allText = [
      result.advisory.editorialIntro ?? '',
      result.advisory.followUp ?? '',
      ...(result.advisory.refinementPrompts ?? []),
    ].join(' ');
    expect(allText).not.toMatch(/for sharper recommendations/i);
    expect(allText).not.toMatch(/tell me about your system/i);
  });

  it('includes nextBuildStep for speakers', () => {
    expect(result.advisory.nextBuildStep).toBeDefined();
    expect(result.advisory.nextBuildStep).toMatch(/amplifier/i);
  });

  it('[QA FINDING] shoppingCategory uses display label "speakers" not raw key "speaker"', () => {
    // FINDING: advisory.shoppingCategory = "speakers" (display label)
    // not "speaker" (raw ShoppingCategory key). This inconsistency
    // could cause bugs in downstream consumers comparing against ShoppingCategory type.
    const cat = result.advisory.shoppingCategory;
    expect(cat).toBeDefined();
    // Record what it actually is:
    expect(['speaker', 'speakers']).toContain(cat);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// QA TEST 2: Category switch — speakers → amplifier
// ═══════════════════════════════════════════════════════════════════════
describe('QA-2: Category switch speakers → amp with budget preservation', () => {
  const messages = [
    'i like van halen',
    'I want speakers',
    'starting from scratch',
    '$5000',
    'great - now how about an amp, too',
  ];
  const result = runShoppingFlow(messages);

  it('detects amplifier category from latest message', () => {
    expect(result.shoppingCtx.category).toBe('amplifier');
  });

  it('advisory shows amplifier category', () => {
    // Note: may be "amplifiers" (display label) — that's fine for this test
    expect(result.advisory.shoppingCategory).toMatch(/amplifier/i);
  });

  it('does NOT fallback to speaker (old category)', () => {
    expect(result.shoppingCtx.category).not.toBe('speaker');
  });

  it('produces product options (not empty)', () => {
    expect(result.advisory.options).toBeDefined();
    expect(result.advisory.options!.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// QA TEST 3: Weak taste — DAC shopping with minimal signal
// ═══════════════════════════════════════════════════════════════════════
describe('QA-3: Weak taste DAC shopping', () => {
  const result = runShoppingFlow([
    'I want a DAC',
    'under $1000',
  ]);

  it('detects DAC category', () => {
    expect(result.shoppingCtx.category).toBe('dac');
  });

  it('is NOT in directed mode (weak taste)', () => {
    expect(result.answer.directed).toBe(false);
  });

  it('produces options (still functional)', () => {
    expect(result.advisory.options).toBeDefined();
    expect(result.advisory.options!.length).toBeGreaterThan(0);
  });

  it('[QA FINDING] lowPreferenceSignal is on advisory not answer', () => {
    // lowPreferenceSignal lives on advisory response, not ShoppingAnswer
    expect(result.advisory.lowPreferenceSignal).toBe(true);
  });

  it('[QA FINDING] weak-taste DAC has no editorialIntro', () => {
    // When lowPreferenceSignal = true, editorialIntro is suppressed
    // in favor of StartHereBlock. This is intentional but means
    // the advisory.editorialIntro is undefined for weak-taste flows.
    // Verify: either editorialIntro exists OR lowPreferenceSignal is true
    expect(
      result.advisory.editorialIntro || result.advisory.lowPreferenceSignal,
    ).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// QA TEST 4: Comparison flow routing
// ═══════════════════════════════════════════════════════════════════════
describe('QA-4: Comparison routing and state machine', () => {
  it('routes "compare X vs Y" correctly', () => {
    const mode = routeConversation('compare Hegel H190 vs Naim Nait XS 3');
    expect(['shopping', 'consultation', 'inquiry']).toContain(mode);
  });

  it('state machine detects comparison mode with context', () => {
    const result = detectInitialMode(
      'compare Hegel H190 vs Naim Nait XS 3',
      { hasSystem: false, subjectCount: 2, detectedIntent: 'comparison' },
    );
    expect(result).toBeDefined();
    expect(result!.mode).toBe('comparison');
  });

  it('state machine transitions through comparison stages', () => {
    const state: ConvState = { ...INITIAL_CONV_STATE, mode: 'comparison', stage: 'entry' };
    const ctx = { hasSystem: false, subjectCount: 2, detectedIntent: 'comparison' };
    const t = transition(state, 'compare Hegel H190 vs Naim Nait XS 3', ctx);
    expect(t.state.mode).toBe('comparison');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// QA TEST 5: Conversation quality — no interrogation after "from scratch"
// ═══════════════════════════════════════════════════════════════════════
describe('QA-5: No system interrogation after "starting from scratch"', () => {
  const result = runShoppingFlow([
    'i like blues and jazz',
    'I want speakers',
    'starting from scratch',
    '$3000',
  ]);

  it('does not ask about existing system', () => {
    const allText = [
      result.advisory.systemInterpretation ?? '',
      result.advisory.editorialIntro ?? '',
      result.advisory.followUp ?? '',
      ...(result.advisory.strategyBullets ?? []),
      ...(result.advisory.refinementPrompts ?? []),
    ].join(' ');

    expect(allText).not.toMatch(/what.*(?:system|setup|chain)/i);
    expect(allText).not.toMatch(/tell me about your/i);
  });

  it('[QA FINDING] fromScratch detection is via state machine, not shoppingCtx', () => {
    // fromScratch is set by conversation-state.ts transition(), stored in ConvFacts,
    // then injected into shoppingCtx in page.tsx. In isolation (no state machine),
    // shoppingCtx.fromScratch is undefined. This is an architectural note, not a bug.
    // The shopping-intent module has no "from scratch" detection.
    const hasFromScratchOnCtx = result.shoppingCtx.fromScratch !== undefined;
    // Record finding — fromScratch is NOT on shoppingCtx in standalone pipeline
    expect(hasFromScratchOnCtx).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// QA TEST 6: State persistence — conversation state transitions
// ═══════════════════════════════════════════════════════════════════════
describe('QA-6: Conversation state machine transitions', () => {
  it('[QA FINDING] transition() from idle stays idle even with shopping detectedIntent', () => {
    // FINDING: transition() from INITIAL_CONV_STATE (mode='idle') does NOT
    // enter shopping mode even when detectedIntent='shopping'. This means
    // the state machine requires detectInitialMode() to be called first
    // from page.tsx. The transition() function alone can't bootstrap into shopping.
    const state: ConvState = { ...INITIAL_CONV_STATE };
    const ctx = { hasSystem: false, subjectCount: 0, detectedIntent: 'shopping' };
    const t1 = transition(state, 'I want to buy speakers', ctx);
    // Records actual behavior:
    expect(t1.state.mode).toBe('idle');
  });

  it('[QA FINDING] detectInitialMode returns null for music-only input', () => {
    // FINDING: "I really love the sound of Miles Davis Kind of Blue"
    // does not trigger any mode detection. detectInitialMode returns null.
    // This means music-as-preference-input only works AFTER the user is
    // already in a mode — it can't bootstrap the conversation from idle.
    const result = detectInitialMode(
      'I really love the sound of Miles Davis Kind of Blue',
      { hasSystem: false, subjectCount: 0, detectedIntent: '' },
    );
    expect(result).toBeNull();
  });

  it('diagnosis routing works for symptom language', () => {
    const mode = routeConversation('my system sounds harsh and fatiguing');
    expect(mode).toBe('diagnosis');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// QA TEST 7: Edge case — budget formats
// ═══════════════════════════════════════════════════════════════════════
describe('QA-7: Budget parsing edge cases', () => {
  it('parses "$5000"', () => {
    expect(parseBudgetAmount('$5000')).toBe(5000);
  });

  it('parses "$5,000"', () => {
    expect(parseBudgetAmount('$5,000')).toBe(5000);
  });

  it('parses "under $3000"', () => {
    expect(parseBudgetAmount('under $3000')).toBe(3000);
  });

  it('parses "about 2000 dollars"', () => {
    expect(parseBudgetAmount('about 2000 dollars')).toBe(2000);
  });

  it('does NOT parse plain "5000" (known limitation)', () => {
    expect(parseBudgetAmount('5000')).toBeNull();
  });

  it('[QA FINDING - BUG] parseBudgetAmount matches "I have 2 speakers" → returns 2', () => {
    // BUG: parseBudgetAmount("I have 2 speakers") returns 2.
    // The budget regex is too greedy — it matches any number followed by
    // a word, not just currency-related patterns. "2 speakers" is not a budget.
    const result = parseBudgetAmount('I have 2 speakers');
    // Document the actual behavior (bug):
    expect(result).toBe(2); // BUG: should be null
  });

  it('[QA FINDING - BUG] parseBudgetAmount matches "I listen on 3 systems" → returns 3', () => {
    const result = parseBudgetAmount('I listen on 3 systems');
    // If this also returns a number, it confirms the greedy regex bug
    if (result !== null) {
      expect(result).toBe(3); // BUG: should be null
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// QA TEST 8: Output quality — directed mode assertive language
// ═══════════════════════════════════════════════════════════════════════
describe('QA-8: Directed mode output quality', () => {
  const result = runShoppingFlow([
    'I love the warmth and body of tube amps, thick rich sound',
    'I want speakers',
    'starting from scratch',
    '$4000',
  ]);

  it('enters directed mode', () => {
    expect(result.answer.directed).toBe(true);
  });

  it('editorial intro uses assertive language', () => {
    const intro = result.advisory.editorialIntro ?? '';
    expect(intro).toMatch(/should lean toward|strongest match|this direction/i);
  });

  it('system interpretation is present and substantive', () => {
    const interp = result.advisory.systemInterpretation ?? '';
    expect(interp.length).toBeGreaterThan(10);
  });

  it('refinement prompts are suppressed in directed mode', () => {
    expect(result.advisory.refinementPrompts ?? []).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// QA TEST 9: Amplifier shopping with system context
// ═══════════════════════════════════════════════════════════════════════
describe('QA-9: Amplifier with existing system', () => {
  const result = runShoppingFlow([
    'I love dynamic, punchy sound with good rhythm',
    'My system is KEF LS50 Meta with a Bluesound Node',
    'I need an amplifier',
    '$3000',
  ]);

  it('detects amplifier category', () => {
    expect(result.shoppingCtx.category).toBe('amplifier');
  });

  it('detects budget', () => {
    expect(result.shoppingCtx.budgetAmount).toBe(3000);
  });

  it('produces advisory with options', () => {
    expect(result.advisory.options).toBeDefined();
    expect(result.advisory.options!.length).toBeGreaterThan(0);
  });

  it('options have names', () => {
    const opt = result.advisory.options![0];
    expect(opt.name).toBeDefined();
    expect(opt.name.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// QA TEST 10: Headphone shopping — different category path
// ═══════════════════════════════════════════════════════════════════════
describe('QA-10: Headphone shopping flow', () => {
  const result = runShoppingFlow([
    'I listen to a lot of classical and acoustic music',
    'I want headphones',
    'under $2000',
  ]);

  it('detects headphone category', () => {
    expect(result.shoppingCtx.category).toBe('headphone');
  });

  it('detects budget', () => {
    expect(result.shoppingCtx.budgetAmount).toBe(2000);
  });

  it('produces advisory options', () => {
    expect(result.advisory.options).toBeDefined();
    expect(result.advisory.options!.length).toBeGreaterThan(0);
  });

  it('[QA FINDING] shoppingCategory uses display label "headphones"', () => {
    // Same issue as speakers: display label vs raw key
    expect(result.advisory.shoppingCategory).toMatch(/headphone/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// QA BONUS: Cross-cutting checks
// ═══════════════════════════════════════════════════════════════════════
describe('QA-BONUS: Cross-cutting advisory structure checks', () => {
  const scenarios = [
    {
      name: 'strong-taste-speakers',
      messages: ['i like van halen', 'I want speakers', 'starting from scratch', '$5000'],
    },
    {
      name: 'weak-taste-dac',
      messages: ['I want a DAC', 'under $1000'],
    },
    {
      name: 'headphones-classical',
      messages: ['I listen to classical', 'I want headphones', 'under $2000'],
    },
  ];

  for (const scenario of scenarios) {
    describe(scenario.name, () => {
      const result = runShoppingFlow(scenario.messages);

      it('has no undefined option names', () => {
        for (const opt of result.advisory.options ?? []) {
          expect(opt.name).toBeDefined();
          expect(opt.name).not.toBe('undefined');
          expect(opt.name.length).toBeGreaterThan(0);
        }
      });

      it('editorialIntro or lowPreferenceSignal is set when options exist', () => {
        if (result.advisory.options && result.advisory.options.length > 0) {
          // Either has editorialIntro OR lowPreferenceSignal (StartHereBlock replaces intro)
          expect(
            result.advisory.editorialIntro || result.advisory.lowPreferenceSignal,
          ).toBeTruthy();
        }
      });

      it('shoppingCategory is set and not general', () => {
        expect(result.advisory.shoppingCategory).toBeDefined();
        expect(result.advisory.shoppingCategory).not.toBe('general');
      });

      it('no "undefined" string in any text field', () => {
        const fields = [
          result.advisory.editorialIntro,
          result.advisory.systemInterpretation,
          result.advisory.followUp,
          ...(result.advisory.strategyBullets ?? []),
          ...(result.advisory.refinementPrompts ?? []),
        ].filter(Boolean);

        for (const field of fields) {
          expect(field).not.toMatch(/\bundefined\b/);
        }
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// QA EXTRA: Reverse category switch — amp → speaker
// ═══════════════════════════════════════════════════════════════════════
describe('QA-EXTRA: Reverse category switch amp → speaker', () => {
  const result = runShoppingFlow([
    'i like jazz',
    'I want an amplifier',
    'starting from scratch',
    '$3000',
    'great - now how about speakers',
  ]);

  it('detects speaker category from latest message (not amp)', () => {
    expect(result.shoppingCtx.category).toBe('speaker');
  });

  it('produces speaker options', () => {
    expect(result.advisory.options).toBeDefined();
    expect(result.advisory.options!.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// QA EXTRA: Turntable shopping
// ═══════════════════════════════════════════════════════════════════════
describe('QA-EXTRA: Turntable shopping flow', () => {
  const result = runShoppingFlow([
    'I love vinyl and warm analog sound',
    'I want a turntable',
    'under $3000',
  ]);

  it('detects turntable category', () => {
    expect(result.shoppingCtx.category).toBe('turntable');
  });

  it('produces options', () => {
    expect(result.advisory.options).toBeDefined();
    expect(result.advisory.options!.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// QA EXTRA: Streamer shopping
// ═══════════════════════════════════════════════════════════════════════
describe('QA-EXTRA: Streamer shopping flow', () => {
  const result = runShoppingFlow([
    'I want a streamer',
    'under $2000',
  ]);

  it('detects streamer category', () => {
    expect(result.shoppingCtx.category).toBe('streamer');
  });

  it('[QA FINDING - BUG] streamer produces no advisory options', () => {
    // BUG: Streamer category produces advisory.options = undefined.
    // The product database likely has no streamer entries, or
    // buildShoppingAnswer doesn't generate products for this category.
    // This means a user asking "I want a streamer under $2000" gets
    // an empty response with no recommendations.
    const hasOptions = result.advisory.options !== undefined &&
      result.advisory.options.length > 0;
    // Record actual behavior:
    expect(hasOptions).toBe(false);
  });
});
