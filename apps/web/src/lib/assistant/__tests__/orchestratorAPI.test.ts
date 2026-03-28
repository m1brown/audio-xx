/**
 * Tests for the orchestrator API route and shadow client.
 *
 * Since Next.js API routes are hard to unit-test in isolation (they need
 * NextRequest/NextResponse), these tests validate:
 *   1. The route handler logic (runAudioXXAssistant with realistic input)
 *   2. The shadow client's fetch-based call path (mocked fetch)
 *   3. Error handling (network failures, invalid responses)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runAudioXXAssistant } from '../runAudioXXAssistant';
import type { OrchestratorInput, OrchestratorOutput } from '../runAudioXXAssistant';
import {
  buildOrchestratorInput,
  fireShadowOrchestrator,
} from '../shadowOrchestrator';
import type { ShadowOrchestratorContext } from '../shadowOrchestrator';
import type { ProductExample } from '../../shopping-intent';
import type { Message } from '../../conversation-types';

// ── Helpers ──────────────────────────────────────────────

/** Flatten console spy args into a single string (handles %s/%d format strings). */
function spyToStrings(spy: ReturnType<typeof vi.spyOn>): string[] {
  return spy.mock.calls.map((args) => {
    const fmt = String(args[0]);
    let i = 1;
    return fmt.replace(/%[sdj]/g, () => {
      const val = args[i++];
      return val === undefined ? '' : String(val);
    });
  });
}

// ── Test Fixtures ────────────────────────────────────────

function makeSampleProducts(): ProductExample[] {
  return [
    {
      name: 'SuperNait 3',
      brand: 'Naim',
      price: 4500,
      fitNote: 'Fast, rhythmic integrated.',
      character: 'Propulsive and rhythmic.',
      caution: 'Less forgiving of bright sources.',
      availability: 'current',
      catalogTopology: 'class-ab-solid-state',
      catalogBrandScale: 'specialist',
    } as ProductExample,
    {
      name: 'H190',
      brand: 'Hegel',
      price: 2995,
      fitNote: 'Transparent, controlled.',
      character: 'Clean authority.',
      caution: 'Can sound clinical.',
      availability: 'current',
      catalogTopology: 'class-ab-solid-state',
      catalogBrandScale: 'specialist',
    } as ProductExample,
    {
      name: 'EX-M1+',
      brand: 'Kinki Studio',
      price: 2898,
      fitNote: 'Warm, smooth.',
      character: 'Musical and relaxed.',
      caution: 'Less dynamic authority.',
      availability: 'current',
      catalogTopology: 'class-ab-solid-state',
      catalogBrandScale: 'boutique',
    } as ProductExample,
  ];
}

function makeContext(): ShadowOrchestratorContext {
  return {
    messages: [
      { role: 'user', content: 'I listen to Van Halen' },
      { role: 'assistant', content: 'Got it.', kind: 'note' },
      { role: 'user', content: 'No tubes. Class AB only. Under $5000.' },
    ],
    allUserText: 'I listen to Van Halen. No tubes. Class AB only. Under $5000.',
    currentMessage: 'No tubes. Class AB only. Under $5000.',
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
  };
}

// ── Test 1: API route handler logic ──────────────────────

describe('Orchestrator API — route handler logic', () => {

  it('returns valid structured JSON for shopping input', async () => {
    // Simulate what the API route does: take OrchestratorInput, call runAudioXXAssistant
    const input = buildOrchestratorInput(makeContext());
    const output = await runAudioXXAssistant(input);

    // Verify the response is valid JSON-serializable
    const serialized = JSON.stringify(output);
    expect(serialized).toBeTruthy();
    const parsed = JSON.parse(serialized) as OrchestratorOutput;

    // Verify structure matches OrchestratorOutput
    expect(parsed.responseText).toBeTruthy();
    expect(parsed.structured).toBeDefined();
    expect(parsed.structured.type).toBe('shopping_recommendation');
    expect(parsed.debug).toBeDefined();
    expect(parsed.debug.mode).toBe('shopping');
    expect(parsed.debug.version).toBe('0.3.0');
    expect(typeof parsed.debug.timestamp).toBe('number');
    expect(typeof parsed.debug.llmCalled).toBe('boolean');
  });

  it('returns ShoppingDecisionOutput with all required fields', async () => {
    const input = buildOrchestratorInput(makeContext());
    const output = await runAudioXXAssistant(input);

    // Serialize + deserialize to simulate the API roundtrip
    const roundtripped = JSON.parse(JSON.stringify(output)) as OrchestratorOutput;

    if (roundtripped.structured.type === 'shopping_recommendation') {
      const data = roundtripped.structured.data;

      // PreferenceSummary
      expect(data.preferenceSummary.values.length).toBeGreaterThan(0);
      expect(Array.isArray(data.preferenceSummary.avoids)).toBe(true);
      expect(typeof data.preferenceSummary.optimizingFor).toBe('string');

      // Recommendations
      expect(data.recommendations.length).toBeGreaterThan(0);
      expect(data.recommendations.length).toBeLessThanOrEqual(3);
      for (const rec of data.recommendations) {
        expect(['best_choice', 'upgrade_choice', 'value_choice']).toContain(rec.role);
        expect(rec.productName.length).toBeGreaterThan(0);
        expect(rec.whyThisFitsYou.length).toBeGreaterThan(0);
        expect(rec.soundCharacter.length).toBeGreaterThan(0);
        expect(rec.tradeoffs.length).toBeGreaterThan(0);
        expect(rec.buyingNote.length).toBeGreaterThan(0);
      }

      // Guidance
      expect(data.overallGuidance.length).toBeGreaterThan(0);
      expect(data.whatToAvoid.length).toBeGreaterThan(0);
    }
  });

  it('handles missing candidates gracefully', async () => {
    const input = buildOrchestratorInput({
      ...makeContext(),
      productExamples: [],
    });
    // Empty candidates — should still return a valid output
    const output = await runAudioXXAssistant(input);
    expect(output.structured.type).toBe('shopping_recommendation');
    expect(output.debug.candidatesAfterFilter).toBe(0);
  });
});

// ── Test 2: Shadow client fetch path ─────────────────────

describe('Shadow client — fetch-based API call', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('POSTs to /api/orchestrator and logs successful output', async () => {
    const mockOutput: OrchestratorOutput = {
      responseText: 'Test response',
      structured: {
        type: 'shopping_recommendation',
        data: {
          preferenceSummary: { values: ['rock'], avoids: ['tubes'], optimizingFor: 'test' },
          recommendations: [{
            role: 'best_choice',
            productName: 'Naim SuperNait 3',
            whyThisFitsYou: 'Great fit.',
            soundCharacter: 'Fast.',
            tradeoffs: 'Bright sources.',
            buyingNote: '$4500 new.',
          }],
          overallGuidance: 'Good options.',
          whatToAvoid: 'Avoid bright amps.',
        },
      },
      debug: {
        mode: 'shopping',
        timestamp: Date.now(),
        llmCalled: true,
        version: '0.3.0',
        llmProvider: 'openai',
        llmModel: 'gpt-4o',
        candidatesReceived: 3,
        candidatesAfterFilter: 3,
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOutput,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // fireShadowOrchestrator is fire-and-forget, so we need to wait
    fireShadowOrchestrator(makeContext());

    // Wait for the async fetch to complete
    await new Promise((r) => setTimeout(r, 50));

    // Verify fetch was called with /api/orchestrator
    const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0][0]).toBe('/api/orchestrator');
    expect(fetchCalls[0][1].method).toBe('POST');

    // Verify the payload is valid OrchestratorInput JSON
    const sentBody = JSON.parse(fetchCalls[0][1].body);
    expect(sentBody.mode).toBe('shopping');
    expect(sentBody.candidates.length).toBe(3);

    // Verify output was logged (console.log uses %s format strings, so check
    // the format template in c[0] and the substitution args in c[1..])
    const logMessages = spyToStrings(logSpy);
    expect(logMessages.some((m: string) => m.includes('[orchestrator-shadow] ── Output ──'))).toBe(true);
    expect(logMessages.some((m: string) => m.includes('llmCalled=true'))).toBe(true);

    logSpy.mockRestore();
  });

  it('handles API error response gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error', fallbackOutput: null }),
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    fireShadowOrchestrator(makeContext());
    await new Promise((r) => setTimeout(r, 50));

    const warnMessages = spyToStrings(warnSpy);
    expect(warnMessages.some((m: string) => m.includes('[orchestrator-shadow] API returned 500'))).toBe(true);

    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('handles network failure gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network unreachable'));

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Must not throw
    expect(() => fireShadowOrchestrator(makeContext())).not.toThrow();
    await new Promise((r) => setTimeout(r, 50));

    const errorMessages = spyToStrings(errorSpy);
    expect(errorMessages.some((m: string) =>
      typeof m === 'string' && m.includes('[orchestrator-shadow]')
    )).toBe(true);

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('uses fallbackOutput from error response when available', async () => {
    const fallback: OrchestratorOutput = {
      responseText: 'Fallback response',
      structured: { type: 'shopping_recommendation', data: {
        preferenceSummary: { values: ['test'], avoids: [], optimizingFor: 'test' },
        recommendations: [], overallGuidance: 'fallback', whatToAvoid: 'n/a',
      }},
      debug: { mode: 'shopping', timestamp: Date.now(), llmCalled: false, version: 'error', fallbackReason: 'test' },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Crashed', fallbackOutput: fallback }),
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    fireShadowOrchestrator(makeContext());
    await new Promise((r) => setTimeout(r, 50));

    // Should still log the fallback output
    const logMessages = spyToStrings(logSpy);
    expect(logMessages.some((m: string) => m.includes('[orchestrator-shadow] ── Output ──'))).toBe(true);

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
