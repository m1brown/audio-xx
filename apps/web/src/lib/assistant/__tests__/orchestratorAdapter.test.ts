/**
 * Tests for the orchestrator → advisory adapter.
 *
 * Three paths:
 *   1. Success: orchestrator returns valid ShoppingDecisionOutput → AdvisoryResponse
 *   2. Fallback: orchestrator returns invalid/empty output → null (deterministic used)
 *   3. Flag off: isOrchestratorRenderEnabled() returns false
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isOrchestratorRenderEnabled,
  extractValidShoppingOutput,
  orchestratorToAdvisory,
  logRenderSource,
} from '../orchestratorAdapter';
import type { OrchestratorOutput, ShoppingDecisionOutput } from '../runAudioXXAssistant';
import type { ProductExample } from '../../shopping-intent';

// ── Fixtures ──────────────────────────────────────────────

function makeShoppingDecisionOutput(): ShoppingDecisionOutput {
  return {
    preferenceSummary: {
      values: ['Dynamic, energetic presentation', 'Tight bass control', 'Forward midrange'],
      avoids: ['Overly warm or soft sound', 'Tube fragility'],
      optimizingFor: 'Finding a class AB solid-state integrated amplifier under $5000 that delivers dynamic, rhythmic sound for rock in a large room.',
    },
    recommendations: [
      {
        role: 'best_choice',
        productName: 'Naim SuperNait 3',
        whyThisFitsYou: 'The SuperNait 3 adds rhythmic drive — it will make rock feel propulsive.',
        soundCharacter: 'Fast, forward, rhythmically insistent. Midrange has presence without warmth.',
        tradeoffs: 'Not forgiving of bright sources. Locked into Naim DIN ecosystem.',
        buyingNote: '$4500 new. $3200–$3800 used. Strong used market.',
      },
      {
        role: 'upgrade_choice',
        productName: 'Hegel H190',
        whyThisFitsYou: 'If you want more control and grip, the H190 delivers authority.',
        soundCharacter: 'Controlled, authoritative, detailed. Excellent damping factor.',
        tradeoffs: 'Can sound analytical with some speakers. Less forgiving of poor recordings.',
        buyingNote: '$4000 new. $2800–$3200 used.',
      },
      {
        role: 'value_choice',
        productName: 'Kinki Studio EX-M1+',
        whyThisFitsYou: 'Outstanding value — punches well above its price class.',
        soundCharacter: 'Open, dynamic, slightly warm. Excellent headroom.',
        tradeoffs: 'Chinese brand — service may be limited. Basic remote.',
        buyingNote: '$2500 new. Limited used market.',
      },
    ],
    overallGuidance: 'Your Klipsch Heresy IVs are efficient and dynamic — they need an amp that adds grip and control, not warmth.',
    whatToAvoid: 'Avoid warm-leaning tube amps which would compound the Heresy IV\'s already lively character.',
  };
}

function makeOrchestratorOutput(
  overrides?: Partial<OrchestratorOutput>,
): OrchestratorOutput {
  return {
    responseText: 'Based on your preferences...',
    structured: {
      type: 'shopping_recommendation',
      data: makeShoppingDecisionOutput(),
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
    ...overrides,
  };
}

function makeProductExamples(): ProductExample[] {
  return [
    {
      name: 'SuperNait 3',
      brand: 'Naim',
      price: 4500,
      character: 'Fast, rhythmic, forward.',
      fitNote: 'Great for rock and dynamic music.',
      caution: 'Requires attention to source quality.',
      availability: 'current',
      sourceReferences: [{ source: 'What Hi-Fi?', note: 'Editor\'s Choice 2024', url: 'https://example.com/review' }],
      manufacturerUrl: 'https://naim-audio.com',
      catalogTopology: 'class-ab-solid-state',
      catalogBrandScale: 'specialist',
      pickRole: 'top_pick',
    },
    {
      name: 'H190',
      brand: 'Hegel',
      price: 4000,
      character: 'Controlled, authoritative.',
      fitNote: 'Strong control and detail.',
      caution: 'Can sound analytical.',
      availability: 'current',
      catalogTopology: 'class-ab-solid-state',
      catalogBrandScale: 'specialist',
      pickRole: 'upgrade_pick',
    },
    {
      name: 'EX-M1+',
      brand: 'Kinki Studio',
      price: 2500,
      character: 'Open, dynamic, slightly warm.',
      fitNote: 'Excellent value.',
      caution: 'Limited service network.',
      availability: 'current',
      catalogTopology: 'class-ab-solid-state',
      catalogBrandScale: 'boutique',
      pickRole: 'value_pick',
    },
  ];
}

// ── Tests: Feature Flag ──────────────────────────────────

describe('isOrchestratorRenderEnabled', () => {
  const originalEnv = process.env.NEXT_PUBLIC_ORCHESTRATOR_RENDER;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_ORCHESTRATOR_RENDER;
    } else {
      process.env.NEXT_PUBLIC_ORCHESTRATOR_RENDER = originalEnv;
    }
  });

  it('returns false when env var is not set', () => {
    delete process.env.NEXT_PUBLIC_ORCHESTRATOR_RENDER;
    expect(isOrchestratorRenderEnabled()).toBe(false);
  });

  it('returns false when env var is "false"', () => {
    process.env.NEXT_PUBLIC_ORCHESTRATOR_RENDER = 'false';
    expect(isOrchestratorRenderEnabled()).toBe(false);
  });

  it('returns true when env var is "true"', () => {
    process.env.NEXT_PUBLIC_ORCHESTRATOR_RENDER = 'true';
    expect(isOrchestratorRenderEnabled()).toBe(true);
  });
});

// ── Tests: Validation ────────────────────────────────────

describe('extractValidShoppingOutput', () => {
  it('returns ShoppingDecisionOutput for valid orchestrator output', () => {
    const output = makeOrchestratorOutput();
    const result = extractValidShoppingOutput(output);
    expect(result).not.toBeNull();
    expect(result!.recommendations.length).toBe(3);
  });

  it('returns null when output is null', () => {
    expect(extractValidShoppingOutput(null)).toBeNull();
  });

  it('returns null when llmCalled is false', () => {
    const output = makeOrchestratorOutput();
    output.debug.llmCalled = false;
    expect(extractValidShoppingOutput(output)).toBeNull();
  });

  it('returns null when structured type is not shopping_recommendation', () => {
    const output = makeOrchestratorOutput();
    output.structured = { type: 'general_response', data: {} };
    expect(extractValidShoppingOutput(output)).toBeNull();
  });

  it('returns null when recommendations array is empty', () => {
    const output = makeOrchestratorOutput();
    (output.structured.data as ShoppingDecisionOutput).recommendations = [];
    expect(extractValidShoppingOutput(output)).toBeNull();
  });

  it('returns null when preferenceSummary values are empty', () => {
    const output = makeOrchestratorOutput();
    (output.structured.data as ShoppingDecisionOutput).preferenceSummary.values = [];
    expect(extractValidShoppingOutput(output)).toBeNull();
  });
});

// ── Tests: Adapter ───────────────────────────────────────

describe('orchestratorToAdvisory — success path', () => {
  it('produces a valid AdvisoryResponse with kind=shopping', () => {
    const advisory = orchestratorToAdvisory({
      shoppingOutput: makeShoppingDecisionOutput(),
      productExamples: makeProductExamples(),
      category: 'amplifier',
      budget: 5000,
      debug: makeOrchestratorOutput().debug,
    });

    expect(advisory.kind).toBe('shopping');
    expect(advisory.advisoryMode).toBe('upgrade_suggestions');
    expect(advisory.subject).toBe('amplifier');
  });

  it('maps preference summary to listenerPriorities and listenerAvoids', () => {
    const advisory = orchestratorToAdvisory({
      shoppingOutput: makeShoppingDecisionOutput(),
      productExamples: makeProductExamples(),
      category: 'amplifier',
      budget: 5000,
      debug: makeOrchestratorOutput().debug,
    });

    expect(advisory.listenerPriorities).toEqual([
      'Dynamic, energetic presentation',
      'Tight bass control',
      'Forward midrange',
    ]);
    expect(advisory.listenerAvoids).toEqual([
      'Overly warm or soft sound',
      'Tube fragility',
    ]);
  });

  it('maps 3 recommendations to 3 AdvisoryOptions', () => {
    const advisory = orchestratorToAdvisory({
      shoppingOutput: makeShoppingDecisionOutput(),
      productExamples: makeProductExamples(),
      category: 'amplifier',
      budget: 5000,
      debug: makeOrchestratorOutput().debug,
    });

    expect(advisory.options).toHaveLength(3);
  });

  it('uses LLM prose for fitNote, character, and caution', () => {
    const advisory = orchestratorToAdvisory({
      shoppingOutput: makeShoppingDecisionOutput(),
      productExamples: makeProductExamples(),
      category: 'amplifier',
      budget: 5000,
      debug: makeOrchestratorOutput().debug,
    });

    const firstOption = advisory.options![0];
    // LLM prose replaces deterministic text
    expect(firstOption.fitNote).toBe('The SuperNait 3 adds rhythmic drive — it will make rock feel propulsive.');
    expect(firstOption.character).toBe('Fast, forward, rhythmically insistent. Midrange has presence without warmth.');
    expect(firstOption.caution).toBe('Not forgiving of bright sources. Locked into Naim DIN ecosystem.');
  });

  it('preserves catalog metadata from original ProductExample', () => {
    const advisory = orchestratorToAdvisory({
      shoppingOutput: makeShoppingDecisionOutput(),
      productExamples: makeProductExamples(),
      category: 'amplifier',
      budget: 5000,
      debug: makeOrchestratorOutput().debug,
    });

    const firstOption = advisory.options![0];
    // Catalog metadata from original product
    expect(firstOption.price).toBe(4500);
    expect(firstOption.brand).toBe('Naim');
    expect(firstOption.availability).toBe('current');
    expect(firstOption.manufacturerUrl).toBe('https://naim-audio.com');
    expect(firstOption.catalogTopology).toBe('class-ab-solid-state');
  });

  it('marks best_choice as isPrimary', () => {
    const advisory = orchestratorToAdvisory({
      shoppingOutput: makeShoppingDecisionOutput(),
      productExamples: makeProductExamples(),
      category: 'amplifier',
      budget: 5000,
      debug: makeOrchestratorOutput().debug,
    });

    expect(advisory.options![0].isPrimary).toBe(true); // best_choice
    expect(advisory.options![1].isPrimary).toBe(false); // upgrade_choice
    expect(advisory.options![2].isPrimary).toBe(false); // value_choice
  });

  it('maps overallGuidance to recommendedDirection', () => {
    const advisory = orchestratorToAdvisory({
      shoppingOutput: makeShoppingDecisionOutput(),
      productExamples: makeProductExamples(),
      category: 'amplifier',
      budget: 5000,
      debug: makeOrchestratorOutput().debug,
    });

    expect(advisory.recommendedDirection).toContain('efficient and dynamic');
  });

  it('maps whatToAvoid to tradeOffs array', () => {
    const advisory = orchestratorToAdvisory({
      shoppingOutput: makeShoppingDecisionOutput(),
      productExamples: makeProductExamples(),
      category: 'amplifier',
      budget: 5000,
      debug: makeOrchestratorOutput().debug,
    });

    expect(advisory.tradeOffs).toHaveLength(1);
    expect(advisory.tradeOffs![0]).toContain('warm-leaning tube amps');
  });

  it('collects source references from matched products', () => {
    const advisory = orchestratorToAdvisory({
      shoppingOutput: makeShoppingDecisionOutput(),
      productExamples: makeProductExamples(),
      category: 'amplifier',
      budget: 5000,
      debug: makeOrchestratorOutput().debug,
    });

    expect(advisory.sourceReferences).toHaveLength(1);
    expect(advisory.sourceReferences![0].source).toBe('What Hi-Fi?');
  });

  it('sets directed=true when budget is provided', () => {
    const advisory = orchestratorToAdvisory({
      shoppingOutput: makeShoppingDecisionOutput(),
      productExamples: makeProductExamples(),
      category: 'amplifier',
      budget: 5000,
      debug: makeOrchestratorOutput().debug,
    });

    expect(advisory.directed).toBe(true);
    expect(advisory.provisional).toBe(false);
    expect(advisory.lowPreferenceSignal).toBe(false);
  });
});

// ── Tests: Fallback Path ─────────────────────────────────

describe('orchestratorToAdvisory — fallback scenarios', () => {
  it('extractValidShoppingOutput returns null for failed LLM → deterministic fallback used', () => {
    const output = makeOrchestratorOutput();
    output.debug.llmCalled = false;
    output.debug.fallbackReason = 'No API key configured';

    const validShopping = extractValidShoppingOutput(output);
    expect(validShopping).toBeNull();
    // Caller would use deterministic advisory instead
  });

  it('handles product name mismatch gracefully', () => {
    const shoppingOutput = makeShoppingDecisionOutput();
    shoppingOutput.recommendations[0].productName = 'Unknown Product XYZ';

    const advisory = orchestratorToAdvisory({
      shoppingOutput,
      productExamples: makeProductExamples(),
      category: 'amplifier',
      budget: 5000,
      debug: makeOrchestratorOutput().debug,
    });

    // Should still produce 3 options, first without catalog metadata
    expect(advisory.options).toHaveLength(3);
    expect(advisory.options![0].name).toBe('Product XYZ'); // Parsed from "Unknown Product XYZ"
    expect(advisory.options![0].price).toBeUndefined(); // No matching product
  });
});

// ── Tests: Logging ───────────────────────────────────────

describe('logRenderSource', () => {
  it('logs orchestrator source with debug info', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logRenderSource('orchestrator', makeOrchestratorOutput().debug as any);

    expect(logSpy).toHaveBeenCalled();
    const msg = logSpy.mock.calls[0].join(' ');
    expect(msg).toContain('[render-source]');

    logSpy.mockRestore();
  });

  it('logs deterministic source', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logRenderSource('deterministic');

    expect(logSpy).toHaveBeenCalled();
    const msg = logSpy.mock.calls[0].join(' ');
    expect(msg).toContain('deterministic');

    logSpy.mockRestore();
  });
});
