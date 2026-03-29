/**
 * Live Flow Trace — mimics the exact page.tsx handleSubmit flow
 * for first-turn messages to identify routing mismatches.
 *
 * Includes the first-turn intent authority bypass that prevents
 * the state machine from overriding high-confidence intents.
 */
import { describe, it, expect } from 'vitest';
import { detectIntent, extractSubjectMatches } from '../intent';
import { routeConversation, resolveMode } from '../conversation-router';
import { detectInitialMode, transition as convTransition, type ConvState } from '../conversation-state';

/**
 * Simulate the first-turn page.tsx handleSubmit flow.
 * Returns every decision point for inspection.
 */
function traceFirstTurn(text: string) {
  // Step 1: Route conversation (line 856)
  const routedMode = routeConversation(text);
  const effectiveMode = resolveMode(routedMode, undefined);

  // Step 2: Detect intent (line 864)
  const { intent, subjectMatches, desires } = detectIntent(text);
  const subjectCount = subjectMatches.length;

  // Step 2b: First-turn intent authority bypass
  // When detectIntent returns a high-confidence mode with sufficient
  // subject evidence, bypass the state machine entirely.
  const intentAuthoritative =
    (intent === 'system_assessment' && subjectCount >= 2) ||
    (intent === 'comparison' && (subjectCount >= 2 || /\bvs\.?\b/i.test(text))) ||
    (intent === 'product_assessment' && subjectCount >= 1);

  // Step 3: Detect initial mode (only when intent is NOT authoritative)
  const hasSystem = false; // first turn, no stored system
  let initialConvMode: ConvState | null = null;
  if (!intentAuthoritative) {
    initialConvMode = detectInitialMode(text, {
      detectedIntent: intent,
      hasSystem,
      subjectCount,
    });
  }

  // Step 4: Simulate mode-specific blocks (lines 896-986)
  let finalIntent = intent;
  let earlyReturn: string | null = null;
  let convState: ConvState | null = initialConvMode;

  if (intentAuthoritative) {
    // Intent bypassed state machine — set convState for follow-up context
    if (intent === 'system_assessment') {
      convState = {
        mode: 'system_assessment',
        stage: 'ready_to_assess',
        facts: { hasSystem: true, systemAssessmentText: text, systemComponents: [text] },
      };
    } else if (intent === 'comparison') {
      convState = {
        mode: 'comparison',
        stage: 'ready_to_compare',
        facts: { subjectCount },
      };
    }
    // product_assessment: no convState needed
  } else if (initialConvMode) {
    // System assessment entry — run transition
    if (initialConvMode.mode === 'system_assessment' && initialConvMode.stage === 'entry') {
      const convResult = convTransition(initialConvMode, text, {
        hasSystem,
        subjectCount,
        detectedIntent: intent,
      });
      convState = convResult.state;
      if (convResult.response?.kind === 'question') {
        earlyReturn = `question: ${convResult.response.question}`;
      }
    }

    // Orientation
    if (initialConvMode.mode === 'orientation') {
      earlyReturn = 'orientation question';
    }

    // Diagnosis
    if (initialConvMode.mode === 'diagnosis' && initialConvMode.stage === 'clarify_system') {
      earlyReturn = 'diagnosis: ask for system';
    }

    // Shopping
    if (initialConvMode.mode === 'shopping') {
      finalIntent = 'shopping';
    }

    // Comparison
    if (initialConvMode.mode === 'comparison') {
      if (initialConvMode.stage === 'ready_to_compare') {
        finalIntent = 'comparison';
      } else {
        earlyReturn = 'comparison: ask for targets';
      }
    }
  }

  // Step 5: Determine final handler
  let handler = 'unknown';
  if (earlyReturn) {
    handler = earlyReturn;
  } else if (finalIntent === 'consultation_entry') {
    handler = 'consultation_entry';
  } else if (finalIntent === 'music_input') {
    handler = 'music_input';
  } else if (finalIntent === 'intake') {
    handler = 'intake';
  } else if (finalIntent === 'cable_advisory') {
    handler = 'cable_advisory';
  } else if (finalIntent === 'system_assessment') {
    handler = 'system_assessment';
  } else if (finalIntent === 'product_assessment') {
    handler = 'product_assessment';
  } else if (finalIntent === 'comparison' || finalIntent === 'gear_inquiry') {
    handler = 'gear_response';
  } else if (finalIntent === 'shopping') {
    handler = 'shopping';
  } else if (finalIntent === 'diagnosis') {
    handler = 'diagnosis';
  } else {
    handler = `fallthrough:${finalIntent}`;
  }

  return {
    text,
    routedMode,
    effectiveMode,
    intent,
    subjectCount,
    intentAuthoritative,
    initialConvMode: initialConvMode ? `${initialConvMode.mode}/${initialConvMode.stage}` : null,
    convStateAfter: convState ? `${convState.mode}/${convState.stage}` : null,
    category: initialConvMode?.facts?.category,
    budget: initialConvMode?.facts?.budget,
    finalIntent,
    earlyReturn,
    handler,
  };
}

describe('Live Flow Trace', () => {
  const cases = [
    { input: 'I need a better amp', expectHandler: 'shopping', expectCategory: 'amplifier' },
    { input: 'Warm amp under $3000', expectHandler: 'shopping', expectCategory: 'amplifier' },
    { input: "how's this system? chord hugo + job integrated + WLM Diva", expectHandler: 'system_assessment' },
    { input: 'is chord hugo + job integrated + WLM Diva a good setup?', expectHandler: 'system_assessment' },
    { input: 'compare JOB integrated and WLM Diva vs Crayon and WLM Diva', expectHandler: 'gear_response' },
    { input: 'thoughts on JOB integrated', expectHandler: 'product_assessment' },
  ];

  for (const c of cases) {
    it(`"${c.input.substring(0, 55)}" → ${c.expectHandler}`, () => {
      const trace = traceFirstTurn(c.input);
      console.log(JSON.stringify(trace, null, 2));
      expect(trace.handler).toBe(c.expectHandler);
      if (c.expectCategory) {
        expect(trace.category).toBe(c.expectCategory);
      }
    });
  }
});

describe('Intent Authority Bypass', () => {
  it('system_assessment with 2+ subjects bypasses state machine', () => {
    const trace = traceFirstTurn("how's this system? chord hugo + job integrated + WLM Diva");
    expect(trace.intentAuthoritative).toBe(true);
    expect(trace.initialConvMode).toBeNull(); // state machine was skipped
    expect(trace.handler).toBe('system_assessment');
    expect(trace.convStateAfter).toBe('system_assessment/ready_to_assess');
  });

  it('comparison with "vs" bypasses state machine', () => {
    const trace = traceFirstTurn('compare JOB integrated and WLM Diva vs Crayon and WLM Diva');
    expect(trace.intentAuthoritative).toBe(true);
    expect(trace.initialConvMode).toBeNull();
    expect(trace.handler).toBe('gear_response');
    expect(trace.convStateAfter).toBe('comparison/ready_to_compare');
  });

  it('product_assessment with 1+ subject bypasses state machine', () => {
    const trace = traceFirstTurn('thoughts on JOB integrated');
    expect(trace.intentAuthoritative).toBe(true);
    expect(trace.initialConvMode).toBeNull();
    expect(trace.handler).toBe('product_assessment');
  });

  it('shopping intent does NOT bypass state machine', () => {
    const trace = traceFirstTurn('I need a better amp');
    expect(trace.intentAuthoritative).toBe(false);
    expect(trace.initialConvMode).not.toBeNull();
    expect(trace.handler).toBe('shopping');
  });

  it('shopping with budget does NOT bypass state machine', () => {
    const trace = traceFirstTurn('Warm amp under $3000');
    expect(trace.intentAuthoritative).toBe(false);
    expect(trace.initialConvMode).not.toBeNull();
    expect(trace.handler).toBe('shopping');
  });

  it('system_assessment with category word ("integrated") still bypasses, not hijacked to shopping', () => {
    // Edge case: "integrated" matches amplifier category, but intent is system_assessment
    // because the query has assessment language + chain separator + 2+ subjects.
    // Without the bypass, detectConvMode could route to shopping if budget appeared.
    const trace = traceFirstTurn("is chord hugo + job integrated + WLM Diva a good setup?");
    expect(trace.intentAuthoritative).toBe(true);
    expect(trace.initialConvMode).toBeNull(); // state machine was skipped
    expect(trace.handler).toBe('system_assessment');
  });
});
