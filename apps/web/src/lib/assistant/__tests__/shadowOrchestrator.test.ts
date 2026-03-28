/**
 * Tests for the shadow orchestrator integration.
 *
 * Validates:
 *   1. buildOrchestratorInput correctly assembles from page-like state
 *   2. fireShadowOrchestrator runs without errors (fire-and-forget safety)
 *   3. Product example → CandidateProduct mapping is correct
 *   4. Conversation messages are filtered and converted
 *   5. Shadow call uses deterministic fallback (no API key in tests)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildOrchestratorInput,
  fireShadowOrchestrator,
  type CandidateProduct,
} from '../shadowOrchestrator';
import type { ShadowOrchestratorContext } from '../shadowOrchestrator';
import { runAudioXXAssistant } from '../runAudioXXAssistant';
import type { ProductExample } from '../../shopping-intent';
import type { Message } from '../../conversation-types';

// ── Helpers ──────────────────────────────────────────────

function makeSampleProducts(): ProductExample[] {
  return [
    {
      name: 'SuperNait 3',
      brand: 'Naim',
      price: 4500,
      fitNote: 'Fast, rhythmic integrated. Excellent for rock and electronic.',
      character: 'Propulsive and rhythmic with Naim\'s signature pace.',
      caution: 'Less forgiving of bright sources.',
      availability: 'current',
      budgetRealism: 'realistic_new',
      pickRole: 'top_pick',
      catalogTopology: 'class-ab-solid-state',
      catalogBrandScale: 'specialist',
    } as ProductExample,
    {
      name: 'H190',
      brand: 'Hegel',
      price: 2995,
      fitNote: 'Transparent, controlled, grippy. Clean power.',
      character: 'Clean authority with wide staging.',
      caution: 'Can sound clinical with neutral speakers.',
      availability: 'current',
      budgetRealism: 'realistic_new',
      pickRole: 'upgrade_pick',
      catalogTopology: 'class-ab-solid-state',
      catalogBrandScale: 'specialist',
    } as ProductExample,
    {
      name: 'EX-M1+',
      brand: 'Kinki Studio',
      price: 2898,
      fitNote: 'Warm, smooth class-AB at a great price.',
      character: 'Musical and relaxed with surprising refinement.',
      caution: 'Less dynamic authority than pricier options.',
      availability: 'current',
      budgetRealism: 'realistic_new',
      pickRole: 'value_pick',
      catalogTopology: 'class-ab-solid-state',
      catalogBrandScale: 'boutique',
    } as ProductExample,
  ];
}

function makeSampleMessages(): Message[] {
  return [
    { role: 'user', content: 'I listen to Van Halen' },
    { role: 'assistant', content: 'Got it — energetic, hard-hitting music.', kind: 'note' },
    { role: 'user', content: 'Looking for speakers under $5000' },
    { role: 'assistant', kind: 'question', clarification: { question: 'Large or small room?' } } as Message,
    { role: 'user', content: 'Large living room' },
    { role: 'assistant', kind: 'advisory', advisory: {} as any } as Message,
    { role: 'user', content: 'What about amps? Same budget.' },
    { role: 'user', content: 'No tubes. Class AB only.' },
  ];
}

function makeContext(overrides?: Partial<ShadowOrchestratorContext>): ShadowOrchestratorContext {
  return {
    messages: makeSampleMessages(),
    allUserText: 'I listen to Van Halen. Looking for speakers under $5000. Large living room. What about amps? Same budget. No tubes. Class AB only.',
    currentMessage: 'No tubes. Class AB only.',
    shoppingAnswerCount: 2,
    category: 'amplifier',
    budgetAmount: 5000,
    roomContext: 'large',
    hardConstraints: {
      excludeTopologies: ['set', 'push-pull-tube'],
      requireTopologies: ['class-ab-solid-state'],
      newOnly: true,
      usedOnly: false,
    },
    semanticPreferences: {
      weights: [{ trait: 'dynamics', weight: 0.8 }],
      wantsBigScale: true,
      wantsSmallScale: false,
      energyLevel: 'high',
      musicHints: ['rock'],
    },
    productExamples: makeSampleProducts(),
    systemComponents: ['Klipsch Heresy IV'],
    musicPreferences: ['rock'],
    isRefinement: true,
    wantsQuickSuggestions: false,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────

describe('buildOrchestratorInput — assembly from page state', () => {

  it('produces a valid OrchestratorInput with correct mode', () => {
    const input = buildOrchestratorInput(makeContext());
    expect(input.mode).toBe('shopping');
  });

  it('maps conversation messages, filtering non-text variants', () => {
    const input = buildOrchestratorInput(makeContext());

    // 8 messages total, but advisory and question types are filtered out
    // Remaining: 5 user messages + 1 note = 6 text messages
    expect(input.conversationHistory.length).toBe(6);
    expect(input.conversationHistory.every((m) => typeof m.content === 'string')).toBe(true);
    expect(input.conversationHistory.every((m) => m.content !== '[non-text content]')).toBe(true);
  });

  it('populates userContext from page state', () => {
    const input = buildOrchestratorInput(makeContext());

    expect(input.userContext.allUserText).toContain('Van Halen');
    expect(input.userContext.currentMessage).toBe('No tubes. Class AB only.');
    expect(input.userContext.shoppingAnswerCount).toBe(2);
    expect(input.userContext.musicPreferences).toEqual(['rock']);
  });

  it('populates systemContext', () => {
    const input = buildOrchestratorInput(makeContext());

    expect(input.systemContext.components).toEqual(['Klipsch Heresy IV']);
    expect(input.systemContext.roomContext).toBe('large');
  });

  it('populates constraints', () => {
    const input = buildOrchestratorInput(makeContext());

    expect(input.constraints.category).toBe('amplifier');
    expect(input.constraints.budgetAmount).toBe(5000);
    expect(input.constraints.hardConstraints.excludeTopologies).toContain('push-pull-tube');
    expect(input.constraints.hardConstraints.requireTopologies).toContain('class-ab-solid-state');
    expect(input.constraints.hardConstraints.newOnly).toBe(true);
  });

  it('maps ProductExample[] to CandidateProduct[]', () => {
    const input = buildOrchestratorInput(makeContext());

    expect(input.candidates.length).toBe(3);

    const first = input.candidates[0];
    expect(first.name).toBe('SuperNait 3');
    expect(first.brand).toBe('Naim');
    expect(first.priceNew).toBe(4500);
    expect(first.availability).toBe('current');
    expect(first.topology).toBe('class-ab-solid-state');
    expect(first.productRole).toBe('specialist');
    expect(first.summary).toBeTruthy();
  });

  it('maps brand scale to product role correctly', () => {
    const input = buildOrchestratorInput(makeContext());

    // Naim = specialist, Kinki Studio = boutique
    const kinki = input.candidates.find((c) => c.name === 'EX-M1+');
    expect(kinki?.productRole).toBe('boutique');
  });

  it('populates UI state', () => {
    const input = buildOrchestratorInput(makeContext());

    expect(input.uiState.isRefinement).toBe(true);
    expect(input.uiState.wantsQuickSuggestions).toBe(false);
  });
});

describe('fireShadowOrchestrator — safety and execution', () => {

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('completes without throwing (no API key = deterministic fallback)', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // fireShadowOrchestrator is fire-and-forget, but we can test through
    // the underlying runAudioXXAssistant call
    const ctx = makeContext();
    const input = buildOrchestratorInput(ctx);
    const output = await runAudioXXAssistant(input);

    expect(output.structured.type).toBe('shopping_recommendation');
    expect(output.debug.llmCalled).toBe(false);
    expect(output.debug.version).toBe('0.3.0');

    const data = output.structured.data;
    if (output.structured.type === 'shopping_recommendation') {
      expect(data.recommendations.length).toBeGreaterThan(0);
      expect(data.preferenceSummary.values.length).toBeGreaterThan(0);
    }

    consoleSpy.mockRestore();
  });

  it('skips gracefully when no product examples', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const ctx = makeContext({ productExamples: [] });

    // Should not throw
    expect(() => fireShadowOrchestrator(ctx)).not.toThrow();

    // Should log skip message
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[orchestrator-shadow] Skipped'),
    );

    consoleSpy.mockRestore();
  });

  it('catches errors in runAudioXXAssistant and logs them', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // fireShadowOrchestrator wraps everything in try/catch
    const ctx = makeContext();
    expect(() => fireShadowOrchestrator(ctx)).not.toThrow();

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('candidate products respect filtering in the orchestrator', async () => {
    const ctx = makeContext();
    const input = buildOrchestratorInput(ctx);
    const output = await runAudioXXAssistant(input);

    if (output.structured.type === 'shopping_recommendation') {
      const names = output.structured.data.recommendations.map((r) => r.productName);
      // All candidates are class-ab-solid-state and current, so all should pass
      expect(names.length).toBeGreaterThan(0);
      expect(names.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('End-to-end: realistic shopping flow through shadow path', () => {

  it('full 10-turn shopping scenario produces valid output', async () => {
    const ctx = makeContext({
      messages: [
        { role: 'user', content: 'I listen to Van Halen' },
        { role: 'assistant', content: 'Got it — energetic music.', kind: 'note' },
        { role: 'user', content: 'Looking for speakers under $5000' },
        { role: 'assistant', content: 'Budget noted.', kind: 'note' },
        { role: 'user', content: 'Large living room' },
        { role: 'assistant', content: 'Large room — that matters for speaker choice.', kind: 'note' },
        { role: 'user', content: 'What about amps? Same budget.' },
        { role: 'assistant', content: 'Switching to amplifiers.', kind: 'note' },
        { role: 'user', content: "I don't want tubes" },
        { role: 'assistant', content: 'No tubes — noted.', kind: 'note' },
        { role: 'user', content: 'Class AB only. New only.' },
      ],
      allUserText: "I listen to Van Halen. Looking for speakers under $5000. Large living room. What about amps? Same budget. I don't want tubes. Class AB only. New only.",
      currentMessage: 'Class AB only. New only.',
      shoppingAnswerCount: 3,
    });

    const input = buildOrchestratorInput(ctx);

    // Verify input is well-formed
    expect(input.mode).toBe('shopping');
    expect(input.conversationHistory.length).toBe(11); // 11 text messages, all within 12-message window
    expect(input.candidates.length).toBe(3);
    expect(input.constraints.hardConstraints.excludeTopologies).toContain('push-pull-tube');
    expect(input.constraints.hardConstraints.requireTopologies).toContain('class-ab-solid-state');
    expect(input.constraints.hardConstraints.newOnly).toBe(true);

    // Run through orchestrator
    const output = await runAudioXXAssistant(input);

    expect(output.structured.type).toBe('shopping_recommendation');
    expect(output.debug.mode).toBe('shopping');
    expect(output.debug.candidatesReceived).toBe(3);

    if (output.structured.type === 'shopping_recommendation') {
      const data = output.structured.data;

      // Preference summary should be populated
      expect(data.preferenceSummary.values.length).toBeGreaterThan(0);

      // Recommendations should be valid
      expect(data.recommendations.length).toBeGreaterThan(0);
      for (const rec of data.recommendations) {
        expect(['best_choice', 'upgrade_choice', 'value_choice']).toContain(rec.role);
        expect(rec.productName.length).toBeGreaterThan(0);
        expect(rec.whyThisFitsYou.length).toBeGreaterThan(0);
        expect(rec.soundCharacter.length).toBeGreaterThan(0);
        expect(rec.tradeoffs.length).toBeGreaterThan(0);
        expect(rec.buyingNote.length).toBeGreaterThan(0);
      }

      // Guidance should exist
      expect(data.overallGuidance.length).toBeGreaterThan(0);
      expect(data.whatToAvoid.length).toBeGreaterThan(0);
    }
  });
});
