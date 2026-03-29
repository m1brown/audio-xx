/**
 * Live Flow Trace — mimics the exact page.tsx handleSubmit flow
 * for first-turn messages to identify routing mismatches.
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

  // Step 3: Detect initial mode (line 887)
  const hasSystem = false; // first turn, no stored system
  const subjectCount = subjectMatches.length;
  const initialConvMode = detectInitialMode(text, {
    detectedIntent: intent,
    hasSystem,
    subjectCount,
  });

  // Step 4: Simulate mode-specific blocks (lines 896-986)
  let finalIntent = intent;
  let convModeHint: string | undefined;
  let earlyReturn: string | null = null;
  let convState: ConvState | null = initialConvMode;

  if (initialConvMode) {
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
      // If 'proceed', falls through — no intent override here
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
      if (initialConvMode.stage === 'ready_to_recommend') {
        // Skip clarifications
      }
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
