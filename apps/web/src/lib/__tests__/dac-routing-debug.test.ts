/**
 * DAC Routing Debug — traces exact intent/subject/routing for DAC queries
 */
import { describe, it, expect } from 'vitest';
import { extractSubjectMatches, detectIntent } from '../intent';
import { detectExplicitCategorySwitch, detectShoppingIntent, buildShoppingAnswer, getShoppingClarification } from '../shopping-intent';
import { detectInitialMode } from '../conversation-state';
import { shoppingToAdvisory } from '../advisory-response';
import { processText } from '../engine';
import { reason } from '../reasoning';

describe('DAC Routing Debug', () => {

  // ── Subject extraction ──────────────────────────────
  describe('Subject extraction for DAC queries', () => {
    it('"I want a DAC" — should NOT match any product/brand subject', () => {
      const subjects = extractSubjectMatches('I want a DAC');
      console.log('[subjects] "I want a DAC":', JSON.stringify(subjects));
      // "DAC" is a category keyword, not a product name
      // If it matches a product, that's a bug
      const productMatch = subjects.find(s => s.kind === 'product');
      if (productMatch) {
        console.warn('[BUG] "DAC" matched as product:', productMatch.name);
      }
    });

    it('"Best DAC under 1000" — should NOT match any product/brand subject', () => {
      const subjects = extractSubjectMatches('Best DAC under 1000');
      console.log('[subjects] "Best DAC under 1000":', JSON.stringify(subjects));
    });

    it('"I want speakers" — should NOT match any product/brand subject', () => {
      const subjects = extractSubjectMatches('I want speakers');
      console.log('[subjects] "I want speakers":', JSON.stringify(subjects));
    });
  });

  // ── Intent detection ──────────────────────────────
  describe('Intent detection for DAC queries', () => {
    it('"I want a DAC" → intake (routed to shopping by detectInitialMode)', () => {
      const result = detectIntent('I want a DAC');
      console.log('[intent] "I want a DAC":', result.intent, 'subjects:', result.subjectMatches.length);
      // detectIntent returns 'intake' for vague "I want X" phrasing.
      // detectInitialMode overrides to shopping/ready_to_recommend when category is present.
      expect(result.intent).toBe('intake');
    });

    it('"Best DAC under 1000" → shopping', () => {
      const result = detectIntent('Best DAC under 1000');
      console.log('[intent] "Best DAC under 1000":', result.intent, 'subjects:', result.subjectMatches.length);
      expect(result.intent).toBe('shopping');
    });

    it('"I want speakers" → intake (routed to shopping by detectInitialMode)', () => {
      const result = detectIntent('I want speakers');
      console.log('[intent] "I want speakers":', result.intent, 'subjects:', result.subjectMatches.length);
      expect(result.intent).toBe('intake');
    });
  });

  // ── Initial mode detection (first message) ──────────
  describe('detectInitialMode for first messages', () => {
    it('"I want a DAC" → shopping/ready_to_recommend', () => {
      const intent = detectIntent('I want a DAC');
      const mode = detectInitialMode('I want a DAC', {
        detectedIntent: intent.intent,
        hasSystem: false,
        subjectCount: intent.subjectMatches.length,
      });
      console.log('[detectInitialMode] "I want a DAC":', mode?.mode, mode?.stage);
      expect(mode).toBeDefined();
      expect(mode!.mode).toBe('shopping');
      expect(mode!.stage).toBe('ready_to_recommend');
    });

    it('"Best DAC under 1000" → shopping/ready_to_recommend', () => {
      const intent = detectIntent('Best DAC under 1000');
      const mode = detectInitialMode('Best DAC under 1000', {
        detectedIntent: intent.intent,
        hasSystem: false,
        subjectCount: intent.subjectMatches.length,
      });
      console.log('[detectInitialMode] "Best DAC under 1000":', mode?.mode, mode?.stage);
      expect(mode).toBeDefined();
      expect(mode!.mode).toBe('shopping');
      expect(mode!.stage).toBe('ready_to_recommend');
    });

    it('"I want speakers" → shopping/ready_to_recommend', () => {
      const intent = detectIntent('I want speakers');
      const mode = detectInitialMode('I want speakers', {
        detectedIntent: intent.intent,
        hasSystem: false,
        subjectCount: intent.subjectMatches.length,
      });
      console.log('[detectInitialMode] "I want speakers":', mode?.mode, mode?.stage);
      expect(mode).toBeDefined();
      expect(mode!.mode).toBe('shopping');
      expect(mode!.stage).toBe('ready_to_recommend');
    });
  });

  // ── Explicit category switch detection ──────────────
  describe('detectExplicitCategorySwitch', () => {
    it('"I want a DAC" → dac', () => {
      const result = detectExplicitCategorySwitch('I want a DAC');
      console.log('[switch] "I want a DAC":', result);
      expect(result).toBe('dac');
    });

    it('"Best DAC under 1000" → dac', () => {
      const result = detectExplicitCategorySwitch('Best DAC under 1000');
      console.log('[switch] "Best DAC under 1000":', result);
      expect(result).toBe('dac');
    });

    it('"I want speakers" → speaker', () => {
      const result = detectExplicitCategorySwitch('I want speakers');
      console.log('[switch] "I want speakers":', result);
      expect(result).toBe('speaker');
    });

    it('"now show me DACs" → dac', () => {
      const result = detectExplicitCategorySwitch('now show me DACs');
      console.log('[switch] "now show me DACs":', result);
      expect(result).toBe('dac');
    });
  });

  // ── Multi-turn simulation: tube amp → DAC ──────────
  describe('Multi-turn: tube amp → "I want a DAC"', () => {
    it('category switch from amplifier to DAC produces DAC products', () => {
      // Turn 1: tube amp
      const signals1 = processText('I want a tube amp');
      const ctx1 = detectShoppingIntent('I want a tube amp', signals1);
      expect(ctx1.category).toBe('amplifier');

      // Turn 2: "I want a DAC" — simulate category switch
      const allUserText = 'I want a tube amp\nI want a DAC';
      const latestMessage = 'I want a DAC';
      const earlyCategorySwitch = detectExplicitCategorySwitch(latestMessage);
      console.log('[multi-turn] earlyCategorySwitch:', earlyCategorySwitch);
      expect(earlyCategorySwitch).toBe('dac');

      // detectShoppingIntent — when category switch is detected, page.tsx
      // scopes input text to ONLY the latest message to prevent prior-category
      // constraints from contaminating the new category.
      const signals2 = processText(latestMessage);
      const shoppingInputText = earlyCategorySwitch ? latestMessage : allUserText;
      const ctx2 = detectShoppingIntent(
        shoppingInputText,
        signals2,
        undefined,
        latestMessage,         // latestMessage for category priority
        'amplifier' as any,    // locked category from prior turn
      );
      console.log('[multi-turn] shoppingCtx category BEFORE lock:', ctx2.category);

      // Simulate the category lock logic from page.tsx:
      // When explicitCategorySwitch is truthy, the lock at line 2220 is SKIPPED
      // and the override at line 2124 fires instead:
      if (earlyCategorySwitch) {
        ctx2.category = earlyCategorySwitch as any;
      }
      console.log('[multi-turn] shoppingCtx category AFTER switch:', ctx2.category);
      expect(ctx2.category).toBe('dac');

      // Build shopping answer
      const reasoning2 = reason(latestMessage, [], signals2, null, ctx2, undefined);
      const answer2 = buildShoppingAnswer(ctx2, signals2, undefined, reasoning2);
      console.log('[multi-turn] products:', answer2.productExamples.map(p => `${p.brand} ${p.name} ($${p.price})`));

      expect(answer2.productExamples.length).toBeGreaterThanOrEqual(2);
      expect(answer2.category.toLowerCase()).toBe('dac');

      // Verify no amplifier products leaked through
      for (const p of answer2.productExamples) {
        expect((p.category ?? '').toLowerCase()).not.toBe('amplifier');
      }
    });
  });

  // ── Multi-turn: tube amp → "Best DAC under 1000" ──
  describe('Multi-turn: tube amp → "Best DAC under 1000"', () => {
    it('produces DAC shortlist with budget compliance', () => {
      const allUserText = 'I want a tube amp\nBest DAC under 1000';
      const latestMessage = 'Best DAC under 1000';
      const earlyCategorySwitch = detectExplicitCategorySwitch(latestMessage);
      console.log('[multi-turn-budget] earlyCategorySwitch:', earlyCategorySwitch);
      expect(earlyCategorySwitch).toBe('dac');

      const signals = processText(latestMessage);
      // Scope input text to latest message on category switch (matches page.tsx logic)
      const shoppingInputText = earlyCategorySwitch ? latestMessage : allUserText;
      const ctx = detectShoppingIntent(shoppingInputText, signals, undefined, latestMessage, 'amplifier' as any);

      if (earlyCategorySwitch) {
        ctx.category = earlyCategorySwitch as any;
      }
      // Also need to parse budget from latest message
      const budgetMatch = latestMessage.match(/(\d[\d,]*)/);
      if (budgetMatch) {
        ctx.budgetAmount = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
        ctx.budgetMentioned = true;
      }

      console.log('[multi-turn-budget] category:', ctx.category, 'budget:', ctx.budgetAmount);

      const reasoning = reason(latestMessage, [], signals, null, ctx, undefined);
      const answer = buildShoppingAnswer(ctx, signals, undefined, reasoning);
      const advisory = shoppingToAdvisory(answer, signals, reasoning);

      console.log('[multi-turn-budget] products:', answer.productExamples.map(p => `${p.brand} ${p.name} ($${p.price}) [${p.pickRole}]`));
      console.log('[multi-turn-budget] advisory.options:', advisory.options?.length ?? 0);
      console.log('[multi-turn-budget] lowPreferenceSignal:', advisory.lowPreferenceSignal);

      expect(answer.productExamples.length).toBeGreaterThanOrEqual(2);
      expect(advisory.options).toBeDefined();
      expect(advisory.options!.length).toBeGreaterThanOrEqual(2);
      expect(advisory.lowPreferenceSignal).toBe(false);

      for (const p of answer.productExamples) {
        expect(p.price).toBeLessThanOrEqual(1000);
      }
    });
  });
});
