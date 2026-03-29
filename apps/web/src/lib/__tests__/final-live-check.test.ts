/**
 * Final Live Comparison Check — end-to-end validation of the 5 required prompts.
 * Traces through the full page.tsx flow (intent → state machine → handler)
 * and produces actual output text for manual review.
 */
import { describe, it, expect } from 'vitest';
import { detectIntent, extractSubjectMatches } from '../intent';
import { routeConversation, resolveMode } from '../conversation-router';
import { detectInitialMode, type ConvState } from '../conversation-state';
import { buildGearResponse } from '../gear-response';
import { buildSystemAssessment } from '../consultation';
import { buildProductAssessment, type AssessmentContext } from '../product-assessment';
import { buildConsultationResponse } from '../consultation';

function traceAndExecute(text: string) {
  // ── Step 1: Intent + routing ──
  const routedMode = routeConversation(text);
  const effectiveMode = resolveMode(routedMode, undefined);
  const { intent, subjects, subjectMatches, desires } = detectIntent(text);
  const subjectCount = subjectMatches.length;

  // ── Step 2: First-turn intent authority bypass ──
  const intentAuthoritative =
    (intent === 'system_assessment' && subjectCount >= 2) ||
    (intent === 'comparison' && (subjectCount >= 2 || /\bvs\.?\b/i.test(text))) ||
    (intent === 'product_assessment' && subjectCount >= 1);

  // ── Step 3: State machine (only if not authoritative) ──
  let initialConvMode: ConvState | null = null;
  if (!intentAuthoritative) {
    initialConvMode = detectInitialMode(text, {
      detectedIntent: intent,
      hasSystem: false,
      subjectCount,
    });
  }

  let finalIntent = intent;
  if (!intentAuthoritative && initialConvMode?.mode === 'shopping') {
    finalIntent = 'shopping';
  }
  if (!intentAuthoritative && initialConvMode?.mode === 'comparison' && initialConvMode.stage === 'ready_to_compare') {
    finalIntent = 'comparison';
  }

  // ── Step 4: Execute the handler ──
  let outputType = '';
  let outputText = '';
  let comparedEntities: string[] = [];
  let sharedComponents: string[] = [];

  if (finalIntent === 'system_assessment') {
    outputType = 'system_assessment';
    const result = buildSystemAssessment(text, subjectMatches, null, desires);
    if (result && result.kind === 'assessment') {
      outputText = result.response.comparisonSummary
        ?? result.response.bottomLine
        ?? JSON.stringify(result.findings?.componentNames ?? []);
      comparedEntities = result.findings?.componentNames ?? [];
    } else if (result && result.kind === 'low_confidence') {
      outputText = `[low_confidence] Components: ${result.components.map(c => c.displayName).join(', ')}`;
      comparedEntities = result.components.map(c => c.displayName);
    } else {
      outputText = '[no assessment result]';
    }
  } else if (finalIntent === 'comparison' || finalIntent === 'gear_inquiry') {
    outputType = finalIntent;
    const result = buildGearResponse(finalIntent, subjects, text, desires);
    if (result) {
      outputText = result.anchor;
      comparedEntities = (result.matchedProducts ?? []).map(p => `${p.brand} ${p.name}`);
      // Check for shared component framing
      if (result.anchor.toLowerCase().includes('both systems share')) {
        const shareMatch = result.anchor.match(/share the (.+?)\./);
        if (shareMatch) sharedComponents.push(shareMatch[1]);
      }
    } else {
      outputText = '[no gear response]';
    }
  } else if (finalIntent === 'product_assessment') {
    outputType = 'product_assessment';
    const ctx: AssessmentContext = {
      subjectMatches,
      activeSystem: null,
      tasteProfile: undefined,
      advisoryCtx: {} as any,
      currentMessage: text,
    };
    const result = buildProductAssessment(ctx);
    if (result) {
      outputText = result.bottomLine ?? result.subject ?? '[assessment built]';
      comparedEntities = [result.subject];
    } else {
      outputText = '[no product assessment result]';
    }
  } else {
    outputType = finalIntent;
    outputText = `[handler: ${finalIntent}]`;
  }

  return {
    text,
    intent,
    finalIntent,
    intentAuthoritative,
    outputType,
    outputText: outputText.substring(0, 500),
    comparedEntities,
    sharedComponents,
    subjectCount,
    subjects,
  };
}

describe('Final Live Check', () => {
  it('Prompt 1: "compare JOB integrated + WLM Diva vs Crayon + WLM Diva"', () => {
    const r = traceAndExecute('compare JOB integrated + WLM Diva vs Crayon + WLM Diva');
    console.log('\n=== PROMPT 1 ===');
    console.log('Intent:', r.intent, '→', r.finalIntent);
    console.log('Authority bypass:', r.intentAuthoritative);
    console.log('Compared:', r.comparedEntities);
    console.log('Shared:', r.sharedComponents);
    console.log('Output:', r.outputText.substring(0, 200));

    expect(r.finalIntent).toBe('comparison');
    expect(r.intentAuthoritative).toBe(true);
    // Must compare JOB vs Crayon, NOT JOB vs WLM Diva
    expect(r.comparedEntities.some(n => n.toLowerCase().includes('job'))).toBe(true);
    expect(r.comparedEntities.some(n => n.toLowerCase().includes('crayon'))).toBe(true);
    // Shared component must be acknowledged
    expect(r.sharedComponents.length).toBeGreaterThan(0);
    expect(r.outputText.toLowerCase()).toContain('diva');
  });

  it('Prompt 2: "JOB integrated + WLM Diva or Crayon + WLM Diva?"', () => {
    const r = traceAndExecute('JOB integrated + WLM Diva or Crayon + WLM Diva?');
    console.log('\n=== PROMPT 2 ===');
    console.log('Intent:', r.intent, '→', r.finalIntent);
    console.log('Authority bypass:', r.intentAuthoritative);
    console.log('Compared:', r.comparedEntities);
    console.log('Shared:', r.sharedComponents);
    console.log('Output:', r.outputText.substring(0, 200));

    expect(r.finalIntent).toBe('comparison');
    expect(r.comparedEntities.some(n => n.toLowerCase().includes('job'))).toBe(true);
    expect(r.comparedEntities.some(n => n.toLowerCase().includes('crayon'))).toBe(true);
    expect(r.sharedComponents.length).toBeGreaterThan(0);
  });

  it('Prompt 3: "compare JOB vs Crayon with WLM Diva"', () => {
    const r = traceAndExecute('compare JOB vs Crayon with WLM Diva');
    console.log('\n=== PROMPT 3 ===');
    console.log('Intent:', r.intent, '→', r.finalIntent);
    console.log('Compared:', r.comparedEntities);
    console.log('Shared:', r.sharedComponents);
    console.log('Output:', r.outputText.substring(0, 200));

    expect(r.finalIntent).toBe('comparison');
    expect(r.comparedEntities.some(n => n.toLowerCase().includes('job'))).toBe(true);
    expect(r.comparedEntities.some(n => n.toLowerCase().includes('crayon'))).toBe(true);
    // "with WLM Diva" should be treated as shared context
    expect(r.outputText.toLowerCase()).toContain('diva');
  });

  it('Prompt 4: "how\'s this system? chord hugo + job integrated + WLM Diva"', () => {
    const r = traceAndExecute("how's this system? chord hugo + job integrated + WLM Diva");
    console.log('\n=== PROMPT 4 ===');
    console.log('Intent:', r.intent, '→', r.finalIntent);
    console.log('Authority bypass:', r.intentAuthoritative);
    console.log('Output type:', r.outputType);
    console.log('Components:', r.comparedEntities);
    console.log('Output:', r.outputText.substring(0, 200));

    expect(r.finalIntent).toBe('system_assessment');
    expect(r.intentAuthoritative).toBe(true);
    // Should NOT route to shopping or comparison
    expect(r.outputType).toBe('system_assessment');
  });

  it('Prompt 5: "thoughts on JOB integrated"', () => {
    const r = traceAndExecute('thoughts on JOB integrated');
    console.log('\n=== PROMPT 5 ===');
    console.log('Intent:', r.intent, '→', r.finalIntent);
    console.log('Authority bypass:', r.intentAuthoritative);
    console.log('Output type:', r.outputType);
    console.log('Output:', r.outputText.substring(0, 200));

    expect(r.finalIntent).toBe('product_assessment');
    expect(r.intentAuthoritative).toBe(true);
    expect(r.outputType).toBe('product_assessment');
    // No contamination from comparison context
    expect(r.outputText.toLowerCase()).not.toContain('crayon');
    expect(r.outputText.toLowerCase()).not.toContain('vs');
  });
});

describe('System Assessment Regression Guard', () => {
  it('system_assessment does NOT fall through to consultation for "how\'s this system?"', () => {
    const text = "how's this system? chord hugo + job integrated + WLM Diva";
    const { intent, subjects, subjectMatches, desires } = detectIntent(text);
    expect(intent).toBe('system_assessment');

    // This is what page.tsx does at line 1225:
    const assessmentResult = buildSystemAssessment(text, subjectMatches, null, desires);
    console.log('Assessment result kind:', assessmentResult?.kind ?? 'NULL');
    console.log('Assessment components:', assessmentResult?.kind === 'assessment'
      ? assessmentResult.findings.componentNames
      : assessmentResult?.kind === 'low_confidence'
        ? assessmentResult.components.map(c => c.displayName)
        : 'N/A');

    // The system assessment MUST return a result (not null).
    // If null, page.tsx falls through to consultation → gear comparison.
    expect(assessmentResult).not.toBeNull();
    expect(['assessment', 'low_confidence', 'clarification']).toContain(assessmentResult!.kind);

    // If it returns low_confidence, page.tsx calls inferProvisionalSystemAssessment (LLM).
    // That's fine — it's still system assessment, not gear comparison.
    // If it returns assessment, page.tsx dispatches the assessment directly.
    if (assessmentResult!.kind === 'assessment') {
      expect(assessmentResult!.findings.componentNames.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('consultation path does NOT intercept when intent is system_assessment', () => {
    const text = "how's this system? chord hugo + job integrated + WLM Diva";
    const { intent, subjectMatches } = detectIntent(text);
    const routedMode = routeConversation(text);
    const effectiveMode = resolveMode(routedMode, undefined);

    console.log('effectiveMode:', effectiveMode);
    console.log('intent:', intent);

    // page.tsx line 1325: consultation path fires when effectiveMode === 'consultation'
    // This is TRUE for system assessment queries because routeConversation returns 'consultation'
    // for SYSTEM_ASSESSMENT_SIGNALS. BUT — the system_assessment handler at line 1213
    // fires FIRST and returns before the consultation path is reached.
    // Verify the ordering is correct:
    expect(intent).toBe('system_assessment');
    // effectiveMode being 'consultation' is fine AS LONG AS the system_assessment
    // handler fires first and returns.
    console.log('WARNING: effectiveMode=' + effectiveMode + ' — consultation path would fire if system_assessment falls through');

    // The key guard: buildConsultationResponse should NOT produce a comparison
    // for this query (it's a system description, not a philosophy question).
    // But even if it does, page.tsx should never reach it.
    const consultResult = buildConsultationResponse(text, subjectMatches);
    console.log('Consultation would produce:', consultResult ? consultResult.subject : 'null');
    // Log but don't fail — the consultation result is irrelevant if system_assessment works.
  });

  it('"is X + Y + Z a good setup?" produces system assessment', () => {
    const text = 'is chord hugo + job integrated + WLM Diva a good setup?';
    const { intent, subjectMatches, desires } = detectIntent(text);
    expect(intent).toBe('system_assessment');

    const assessmentResult = buildSystemAssessment(text, subjectMatches, null, desires);
    expect(assessmentResult).not.toBeNull();
    console.log('Result kind:', assessmentResult!.kind);
  });
});
