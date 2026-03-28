/**
 * Unit tests for the unified orchestrator — Step 3.
 *
 * Validates:
 *   1. Deterministic fallback (no API key) produces valid output
 *   2. LLM call with mocked fetch produces structured output
 *   3. Invalid LLM JSON triggers fallback
 *   4. parseShoppingOutput validates correctly
 *   5. buildUserPrompt produces valid JSON
 *   6. Hard constraints are enforced before LLM sees candidates
 *   7. Master prompt tests (unchanged from Step 2)
 *   8. Non-shopping modes (unchanged)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  runAudioXXAssistant,
  filterCandidates,
  type OrchestratorInput,
  type OrchestratorOutput,
  type CandidateProduct,
  type ShoppingDecisionOutput,
  type ShoppingRecommendation,
  type PreferenceSummary,
  type RecommendationRole,
} from '../runAudioXXAssistant';
import {
  parseShoppingOutput,
  buildUserPrompt,
} from '../callShoppingLLM';
import {
  SHOPPING_SYSTEM_PROMPT,
  DIAGNOSIS_SYSTEM_PROMPT,
  GENERAL_SYSTEM_PROMPT,
  PROMPT_VERSION,
} from '../prompts/audioXXMasterPrompt';

// ── Helpers ──────────────────────────────────────────────

const SAMPLE_CANDIDATES: CandidateProduct[] = [
  {
    name: 'SuperNait 3',
    brand: 'Naim',
    category: 'amplifier',
    priceNew: 4500,
    priceUsedRange: { low: 3200, high: 3800 },
    availability: 'current',
    productRole: 'specialist',
    topology: 'class-ab-solid-state',
    subcategory: 'integrated-amp',
    traits: { dynamics: 0.9, composure: 0.85 },
    summary: 'Rhythmic, propulsive integrated with Naim\'s signature timing.',
    tradeoffs: 'Less forgiving of bright sources. Locked to DIN for best results.',
    bestFor: 'Listeners who value pace and timing above all.',
  },
  {
    name: 'H190',
    brand: 'Hegel',
    category: 'amplifier',
    priceNew: 2995,
    availability: 'current',
    productRole: 'specialist',
    topology: 'class-ab-solid-state',
    traits: { dynamics: 1.0, composure: 0.9 },
    summary: 'Transparent, controlled, and grippy. Clean power delivery.',
    tradeoffs: 'Can sound clinical with the wrong speakers.',
    bestFor: 'Listeners who want authority and control.',
  },
  {
    name: 'EX-M1+',
    brand: 'Kinki Studio',
    category: 'amplifier',
    priceNew: 2898,
    availability: 'current',
    productRole: 'specialist',
    topology: 'class-ab-solid-state',
    traits: { dynamics: 0.7, composure: 0.6 },
    summary: 'Warm, smooth class-AB with surprising refinement at the price.',
    tradeoffs: 'Less dynamic authority than higher-priced competitors.',
    bestFor: 'Budget-conscious buyers who want a musical presentation.',
  },
  {
    name: 'CS300',
    brand: 'Leben',
    category: 'amplifier',
    priceNew: 2800,
    availability: 'current',
    productRole: 'specialist',
    topology: 'push-pull-tube',
    traits: { dynamics: 1.0, composure: 0.4 },
    summary: 'Lush, harmonically rich tube integrated.',
    tradeoffs: 'Limited power. Needs efficient speakers.',
    bestFor: 'Tube lovers who prioritize tone.',
  },
  {
    name: 'i35',
    brand: 'Primare',
    category: 'amplifier',
    priceNew: 4500,
    availability: 'current',
    productRole: 'specialist',
    topology: 'class-d',
    traits: { dynamics: 0.9, composure: 0.85 },
  },
  {
    name: 'Legacy Amp',
    brand: 'Oldco',
    category: 'amplifier',
    priceNew: 3000,
    availability: 'discontinued',
    productRole: 'specialist',
    topology: 'class-ab-solid-state',
    traits: { dynamics: 0.8 },
  },
];

function makeShoppingInput(overrides?: Partial<OrchestratorInput>): OrchestratorInput {
  return {
    mode: 'shopping',
    conversationHistory: [
      { role: 'user', content: 'I want class AB amps under $5000', turn: 1 },
    ],
    userContext: {
      allUserText: 'I want class AB amps under $5000. No tubes. I want new.',
      currentMessage: 'class ab amps',
      shoppingAnswerCount: 2,
      musicPreferences: ['rock', 'electronic'],
    },
    systemContext: {
      components: ['Klipsch Heresy IV'],
      roomContext: 'large',
    },
    constraints: {
      category: 'amplifier',
      budgetAmount: 5000,
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
    },
    candidates: SAMPLE_CANDIDATES,
    uiState: {
      isRefinement: true,
      wantsQuickSuggestions: false,
    },
    ...overrides,
  };
}

// ── Mock LLM response ────────────────────────────────────

/** A valid ShoppingDecisionOutput as a raw JSON string, as the LLM would return it. */
const VALID_LLM_RESPONSE: ShoppingDecisionOutput = {
  preferenceSummary: {
    values: [
      'Dynamic, high-energy presentation with impact',
      'Class AB solid-state design — you want authority and grip',
      'Music: rock and electronic — rhythm and bass matter',
    ],
    avoids: [
      'No tubes — you want solid-state control',
      'No class D — preference for traditional amplification',
    ],
    optimizingFor: 'Finding a new class AB integrated amplifier under $5000 that delivers dynamic, rhythmic sound for rock and electronic in a large room with Klipsch Heresy IV speakers.',
  },
  recommendations: [
    {
      role: 'best_choice',
      productName: 'Naim SuperNait 3',
      whyThisFitsYou: 'Your Klipsch Heresy IVs are already efficient and dynamic. The SuperNait 3 adds Naim\'s signature rhythmic drive — it will make rock feel propulsive and electronic feel tight. The pairing emphasizes pace and energy, which aligns with your preference for high-energy listening.',
      soundCharacter: 'Fast, forward, rhythmically insistent. The midrange has presence without warmth. Bass is taut rather than voluminous.',
      tradeoffs: 'The SuperNait 3 is not forgiving of bright or harsh sources. With the Heresy IV\'s already lively treble, you may want to pay attention to your source quality. Also locked into Naim\'s DIN connector ecosystem for best results.',
      buyingNote: '$4500 new. $3200–$3800 used. Currently available. Strong used market due to Naim brand loyalty.',
    },
    {
      role: 'upgrade_choice',
      productName: 'Hegel H190',
      whyThisFitsYou: 'If you want more control and grip than the SuperNait 3, the H190 delivers authority. It will tame the Heresy IV\'s liveliness slightly while maintaining dynamic impact. Good fit if you sometimes listen at higher volumes.',
      soundCharacter: 'Transparent, controlled, with a wide soundstage. Less rhythmically forward than the Naim, but more composed under pressure.',
      tradeoffs: 'Can sound clinical with already-neutral speakers. With the Heresy IV\'s character, this is less of a concern, but it won\'t add warmth.',
      buyingNote: '$2995 new. Currently available.',
    },
    {
      role: 'value_choice',
      productName: 'Kinki Studio EX-M1+',
      whyThisFitsYou: 'At $2898, the EX-M1+ delivers the core class AB experience you want at the lowest price. It has a warmer tilt than the other two, which may actually complement the Heresy IV\'s brightness.',
      soundCharacter: 'Warm, smooth, with a relaxed top end. Less aggressive than the Naim, less controlled than the Hegel. Musical rather than analytical.',
      tradeoffs: 'Less dynamic authority than the SuperNait 3 or H190. If maximum impact matters, this trades some slam for smoothness.',
      buyingNote: '$2898 new. Currently available. Smaller brand — fewer dealers, but direct-order model keeps price low.',
    },
  ],
  overallGuidance: 'All three of these amplifiers will work well with your Heresy IVs in a large room. The real question is whether you prioritize rhythmic drive (Naim), control and composure (Hegel), or warmth and value (Kinki Studio). If possible, audition with your own speakers — the Heresy IV interaction is the key variable here.',
  whatToAvoid: 'Avoid amplifiers with a bright or analytical tilt — your Heresy IVs already have lively treble, and doubling down on brightness will cause listening fatigue over time.',
};

const VALID_LLM_JSON = JSON.stringify(VALID_LLM_RESPONSE);

function mockFetchWithResponse(json: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      content: [{ text: json }],
    }),
  });
}

function mockFetchWithError(status: number) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: async () => 'API error',
  });
}

// ── Tests: Deterministic fallback (no API key) ──────────

describe('runAudioXXAssistant — deterministic fallback (no API key)', () => {

  it('shopping mode returns valid ShoppingDecisionOutput shape', async () => {
    const output = await runAudioXXAssistant(makeShoppingInput());

    expect(output.structured.type).toBe('shopping_recommendation');

    const data = output.structured.data as ShoppingDecisionOutput;

    expect(data.preferenceSummary).toBeDefined();
    expect(data.preferenceSummary.values).toBeInstanceOf(Array);
    expect(data.preferenceSummary.values.length).toBeGreaterThan(0);
    expect(data.preferenceSummary.avoids).toBeInstanceOf(Array);
    expect(data.preferenceSummary.avoids.length).toBeGreaterThan(0);
    expect(typeof data.preferenceSummary.optimizingFor).toBe('string');

    expect(data.recommendations).toBeInstanceOf(Array);
    expect(data.recommendations.length).toBeGreaterThan(0);
    expect(data.recommendations.length).toBeLessThanOrEqual(3);

    expect(typeof data.overallGuidance).toBe('string');
    expect(typeof data.whatToAvoid).toBe('string');
  });

  it('assigns all 3 recommendation roles when 3 candidates pass', async () => {
    const output = await runAudioXXAssistant(makeShoppingInput());
    const data = output.structured.data as ShoppingDecisionOutput;

    expect(data.recommendations.length).toBe(3);

    const roles = data.recommendations.map((r) => r.role);
    expect(roles).toContain('best_choice');
    expect(roles).toContain('upgrade_choice');
    expect(roles).toContain('value_choice');
  });

  it('each recommendation has all required fields', async () => {
    const output = await runAudioXXAssistant(makeShoppingInput());
    const data = output.structured.data as ShoppingDecisionOutput;

    for (const rec of data.recommendations) {
      expect(['best_choice', 'upgrade_choice', 'value_choice']).toContain(rec.role);
      expect(typeof rec.productName).toBe('string');
      expect(rec.productName.length).toBeGreaterThan(0);
      expect(typeof rec.whyThisFitsYou).toBe('string');
      expect(typeof rec.soundCharacter).toBe('string');
      expect(typeof rec.tradeoffs).toBe('string');
      expect(typeof rec.buyingNote).toBe('string');
    }
  });

  it('hard constraints exclude tubes and class-d', async () => {
    const output = await runAudioXXAssistant(makeShoppingInput());
    const data = output.structured.data as ShoppingDecisionOutput;

    const names = data.recommendations.map((r) => r.productName);
    expect(names.every((n) => !n.includes('Leben'))).toBe(true);
    expect(names.every((n) => !n.includes('CS300'))).toBe(true);
    expect(names.every((n) => !n.includes('Primare'))).toBe(true);
    expect(names.every((n) => !n.includes('i35'))).toBe(true);
  });

  it('newOnly constraint excludes discontinued products', async () => {
    const output = await runAudioXXAssistant(makeShoppingInput());
    const data = output.structured.data as ShoppingDecisionOutput;

    const names = data.recommendations.map((r) => r.productName);
    expect(names.every((n) => !n.includes('Legacy'))).toBe(true);
    expect(names.every((n) => !n.includes('Oldco'))).toBe(true);
  });

  it('debug metadata reflects step 3 with fallback', async () => {
    const before = Date.now();
    const output = await runAudioXXAssistant(makeShoppingInput());
    const after = Date.now();

    expect(output.debug.version).toBe('0.3.0');
    expect(output.debug.llmCalled).toBe(false);
    expect(output.debug.timestamp).toBeGreaterThanOrEqual(before);
    expect(output.debug.timestamp).toBeLessThanOrEqual(after);
    expect(output.debug.candidatesReceived).toBe(SAMPLE_CANDIDATES.length);
    expect(output.debug.candidatesAfterFilter).toBe(3);
    expect(output.debug.fallbackReason).toBeDefined();
  });

  it('preference summary reflects music preferences and constraints', async () => {
    const output = await runAudioXXAssistant(makeShoppingInput());
    const data = output.structured.data as ShoppingDecisionOutput;
    const ps = data.preferenceSummary;

    expect(ps.values.some((v) => v.toLowerCase().includes('rock'))).toBe(true);
    expect(ps.avoids.some((a) => a.toLowerCase().includes('push-pull-tube') || a.toLowerCase().includes('set'))).toBe(true);
  });
});

// ── Tests: LLM call with mocked fetch ────────────────────

describe('runAudioXXAssistant — mocked LLM call', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key-123';
    process.env.ORCHESTRATOR_LLM_PROVIDER = 'anthropic';
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ORCHESTRATOR_LLM_PROVIDER;
    delete process.env.ORCHESTRATOR_LLM_MODEL;
    globalThis.fetch = originalFetch;
  });

  it('uses LLM output when API returns valid JSON', async () => {
    globalThis.fetch = mockFetchWithResponse(VALID_LLM_JSON);

    const output = await runAudioXXAssistant(makeShoppingInput());

    expect(output.debug.llmCalled).toBe(true);
    expect(output.debug.llmProvider).toBe('anthropic');
    expect(output.debug.fallbackReason).toBeUndefined();

    const data = output.structured.data as ShoppingDecisionOutput;
    expect(data.recommendations.length).toBe(3);
    expect(data.recommendations[0].productName).toBe('Naim SuperNait 3');
    expect(data.recommendations[0].role).toBe('best_choice');
    expect(data.preferenceSummary.values.length).toBe(3);
    expect(data.overallGuidance).toContain('Heresy IV');
    expect(data.whatToAvoid).toContain('bright');
  });

  it('falls back to deterministic when API returns HTTP error', async () => {
    globalThis.fetch = mockFetchWithError(500);

    const output = await runAudioXXAssistant(makeShoppingInput());

    expect(output.debug.llmCalled).toBe(false);
    expect(output.debug.fallbackReason).toBeDefined();
    expect(output.debug.fallbackReason).toContain('500');

    // Should still produce valid output
    const data = output.structured.data as ShoppingDecisionOutput;
    expect(data.recommendations.length).toBe(3);
  });

  it('falls back when LLM returns invalid JSON', async () => {
    globalThis.fetch = mockFetchWithResponse('This is not JSON at all, just some text.');

    const output = await runAudioXXAssistant(makeShoppingInput());

    expect(output.debug.llmCalled).toBe(false);
    expect(output.debug.fallbackReason).toContain('JSON validation failed');

    const data = output.structured.data as ShoppingDecisionOutput;
    expect(data.recommendations.length).toBe(3);
  });

  it('falls back when LLM returns JSON missing required fields', async () => {
    const incomplete = JSON.stringify({
      preferenceSummary: { values: ['test'], avoids: [], optimizingFor: 'test' },
      // missing recommendations, overallGuidance, whatToAvoid
    });
    globalThis.fetch = mockFetchWithResponse(incomplete);

    const output = await runAudioXXAssistant(makeShoppingInput());

    expect(output.debug.llmCalled).toBe(false);
    expect(output.debug.fallbackReason).toContain('JSON validation failed');
  });

  it('falls back when fetch throws a network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

    const output = await runAudioXXAssistant(makeShoppingInput());

    expect(output.debug.llmCalled).toBe(false);
    expect(output.debug.fallbackReason).toContain('Network timeout');

    const data = output.structured.data as ShoppingDecisionOutput;
    expect(data.recommendations.length).toBe(3);
  });

  it('handles LLM response wrapped in markdown code fences', async () => {
    const wrapped = '```json\n' + VALID_LLM_JSON + '\n```';
    globalThis.fetch = mockFetchWithResponse(wrapped);

    const output = await runAudioXXAssistant(makeShoppingInput());

    expect(output.debug.llmCalled).toBe(true);
    const data = output.structured.data as ShoppingDecisionOutput;
    expect(data.recommendations[0].productName).toBe('Naim SuperNait 3');
  });

  it('debug metadata includes provider and model when LLM succeeds', async () => {
    globalThis.fetch = mockFetchWithResponse(VALID_LLM_JSON);

    const output = await runAudioXXAssistant(makeShoppingInput());

    expect(output.debug.llmProvider).toBe('anthropic');
    expect(output.debug.llmModel).toBeDefined();
    expect(output.debug.llmModel).toContain('claude');
  });

  it('uses OpenAI provider when configured', async () => {
    process.env.ORCHESTRATOR_LLM_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-openai-key';

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: VALID_LLM_JSON } }],
      }),
    });

    const output = await runAudioXXAssistant(makeShoppingInput());

    expect(output.debug.llmCalled).toBe(true);
    expect(output.debug.llmProvider).toBe('openai');

    // Verify fetch was called with OpenAI endpoint
    const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(fetchCalls[0][0]).toContain('openai.com');

    delete process.env.OPENAI_API_KEY;
  });
});

// ── Tests: parseShoppingOutput ───────────────────────────

describe('parseShoppingOutput — JSON validation', () => {
  const candidateNames = ['Naim SuperNait 3', 'Hegel H190', 'Kinki Studio EX-M1+'];

  it('parses valid JSON correctly', () => {
    const result = parseShoppingOutput(VALID_LLM_JSON, candidateNames);
    expect(result).not.toBeNull();
    expect(result!.parsed.recommendations.length).toBe(3);
    expect(result!.warnings.length).toBe(0);
  });

  it('returns null for invalid JSON', () => {
    expect(parseShoppingOutput('not json', candidateNames)).toBeNull();
  });

  it('returns null for JSON missing preferenceSummary', () => {
    const bad = JSON.stringify({
      recommendations: [], overallGuidance: 'x', whatToAvoid: 'y',
    });
    expect(parseShoppingOutput(bad, candidateNames)).toBeNull();
  });

  it('returns null for JSON with empty recommendations', () => {
    const bad = JSON.stringify({
      preferenceSummary: { values: ['a'], avoids: [], optimizingFor: 'x' },
      recommendations: [],
      overallGuidance: 'x',
      whatToAvoid: 'y',
    });
    expect(parseShoppingOutput(bad, candidateNames)).toBeNull();
  });

  it('returns null for recommendation with invalid role', () => {
    const bad = JSON.stringify({
      preferenceSummary: { values: ['a'], avoids: [], optimizingFor: 'x' },
      recommendations: [{
        role: 'invalid_role',
        productName: 'Naim SuperNait 3',
        whyThisFitsYou: 'x',
        soundCharacter: 'x',
        tradeoffs: 'x',
        buyingNote: 'x',
      }],
      overallGuidance: 'x',
      whatToAvoid: 'y',
    });
    expect(parseShoppingOutput(bad, candidateNames)).toBeNull();
  });

  it('discards recommendations with hallucinated product names', () => {
    // When ALL recommendations are hallucinated, returns null (falls back to deterministic)
    const withHallucination = JSON.stringify({
      ...VALID_LLM_RESPONSE,
      recommendations: [
        {
          ...VALID_LLM_RESPONSE.recommendations[0],
          productName: 'Hallucinated Product X',
        },
      ],
    });
    const result = parseShoppingOutput(withHallucination, candidateNames);
    expect(result).toBeNull();
  });

  it('keeps valid recommendations while discarding hallucinated ones', () => {
    // When some recommendations are valid and some hallucinated,
    // only the valid ones survive
    const mixed = JSON.stringify({
      ...VALID_LLM_RESPONSE,
      recommendations: [
        VALID_LLM_RESPONSE.recommendations[0], // valid
        {
          ...VALID_LLM_RESPONSE.recommendations[1],
          productName: 'Hallucinated Product Y',
        },
      ],
    });
    const result = parseShoppingOutput(mixed, candidateNames);
    expect(result).not.toBeNull();
    expect(result!.parsed.recommendations.length).toBe(1);
    expect(result!.warnings.some((w) => w.includes('Hallucinated Product Y'))).toBe(true);
  });

  it('strips markdown code fences before parsing', () => {
    const wrapped = '```json\n' + VALID_LLM_JSON + '\n```';
    const result = parseShoppingOutput(wrapped, candidateNames);
    expect(result).not.toBeNull();
    expect(result!.parsed.recommendations.length).toBe(3);
  });

  it('truncates to 3 recommendations with warning', () => {
    const fourRecs = {
      ...VALID_LLM_RESPONSE,
      recommendations: [
        ...VALID_LLM_RESPONSE.recommendations,
        {
          role: 'value_choice',
          productName: 'Hegel H190',
          whyThisFitsYou: 'x', soundCharacter: 'x', tradeoffs: 'x', buyingNote: 'x',
        },
      ],
    };
    const result = parseShoppingOutput(JSON.stringify(fourRecs), candidateNames);
    expect(result).not.toBeNull();
    expect(result!.parsed.recommendations.length).toBe(3);
    expect(result!.warnings.some((w) => w.includes('truncating'))).toBe(true);
  });
});

// ── Tests: buildUserPrompt ───────────────────────────────

describe('buildUserPrompt — input assembly', () => {

  it('produces valid JSON', () => {
    const input = makeShoppingInput();
    const filtered = filterCandidates(input.candidates, input.constraints);
    const prompt = buildUserPrompt(input, filtered);

    expect(() => JSON.parse(prompt)).not.toThrow();
  });

  it('includes all required context fields', () => {
    const input = makeShoppingInput();
    const filtered = filterCandidates(input.candidates, input.constraints);
    const prompt = buildUserPrompt(input, filtered);
    const parsed = JSON.parse(prompt);

    expect(parsed.constraints).toBeDefined();
    expect(parsed.constraints.category).toBe('amplifier');
    expect(parsed.constraints.budgetAmount).toBe(5000);
    expect(parsed.candidateProducts).toBeInstanceOf(Array);
    expect(parsed.candidateProducts.length).toBe(3); // After filtering
    expect(parsed.userPreferences.musicPreferences).toContain('rock');
    expect(parsed.systemContext.components).toContain('Klipsch Heresy IV');
    expect(parsed.systemContext.roomContext).toBe('large');
  });

  it('only includes filtered candidates (no constraint violators)', () => {
    const input = makeShoppingInput();
    const filtered = filterCandidates(input.candidates, input.constraints);
    const prompt = buildUserPrompt(input, filtered);
    const parsed = JSON.parse(prompt);

    const names = parsed.candidateProducts.map((c: { name: string }) => c.name);
    expect(names.every((n: string) => !n.includes('Leben'))).toBe(true);
    expect(names.every((n: string) => !n.includes('Primare'))).toBe(true);
    expect(names.every((n: string) => !n.includes('Legacy'))).toBe(true);
  });

  it('limits conversation history to last 8 messages', () => {
    const longHistory = Array.from({ length: 14 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i + 1}`,
      turn: i + 1,
    }));
    const input = makeShoppingInput({ conversationHistory: longHistory });
    const filtered = filterCandidates(input.candidates, input.constraints);
    const prompt = buildUserPrompt(input, filtered);
    const parsed = JSON.parse(prompt);

    expect(parsed.recentMessages.length).toBe(8);
    expect(parsed.recentMessages[0].content).toBe('Message 7');
  });
});

// ── Tests: filterCandidates ──────────────────────────────

describe('filterCandidates — exported for testability', () => {

  it('applies budget, topology, and availability filters', () => {
    const filtered = filterCandidates(SAMPLE_CANDIDATES, {
      category: 'amplifier',
      budgetAmount: 5000,
      hardConstraints: {
        excludeTopologies: ['push-pull-tube'],
        requireTopologies: ['class-ab-solid-state'],
        newOnly: true,
        usedOnly: false,
      },
      semanticPreferences: { weights: [], wantsBigScale: false, wantsSmallScale: false, energyLevel: null, musicHints: [] },
    });

    expect(filtered.length).toBe(3);
    expect(filtered.every((c) => c.topology === 'class-ab-solid-state')).toBe(true);
    expect(filtered.every((c) => c.availability === 'current')).toBe(true);
  });

  it('returns empty array when constraints eliminate all candidates', () => {
    const filtered = filterCandidates(SAMPLE_CANDIDATES, {
      category: 'amplifier',
      budgetAmount: 100,
      hardConstraints: { excludeTopologies: [], requireTopologies: [], newOnly: false, usedOnly: false },
      semanticPreferences: { weights: [], wantsBigScale: false, wantsSmallScale: false, energyLevel: null, musicHints: [] },
    });

    expect(filtered.length).toBe(0);
  });
});

// ── Tests: Master prompt ─────────────────────────────────

describe('Master prompt file', () => {

  it('SHOPPING_SYSTEM_PROMPT exports a non-empty string', () => {
    expect(typeof SHOPPING_SYSTEM_PROMPT).toBe('string');
    expect(SHOPPING_SYSTEM_PROMPT.length).toBeGreaterThan(500);
  });

  it('SHOPPING_SYSTEM_PROMPT contains key behavioral rules', () => {
    expect(SHOPPING_SYSTEM_PROMPT).toContain('Audio XX');
    expect(SHOPPING_SYSTEM_PROMPT).toContain('best_choice');
    expect(SHOPPING_SYSTEM_PROMPT).toContain('upgrade_choice');
    expect(SHOPPING_SYSTEM_PROMPT).toContain('value_choice');
    expect(SHOPPING_SYSTEM_PROMPT).toContain('excludeTopologies');
    expect(SHOPPING_SYSTEM_PROMPT).toContain('JSON');
    expect(SHOPPING_SYSTEM_PROMPT).toContain('preferenceSummary');
    expect(SHOPPING_SYSTEM_PROMPT).toContain('whyThisFitsYou');
    expect(SHOPPING_SYSTEM_PROMPT).toContain('tradeoffs');
    expect(SHOPPING_SYSTEM_PROMPT).toContain('Do nothing');
  });

  it('SHOPPING_SYSTEM_PROMPT enforces hard constraint obedience', () => {
    expect(SHOPPING_SYSTEM_PROMPT).toContain('Constraint violations are never acceptable');
    expect(SHOPPING_SYSTEM_PROMPT).toContain('newOnly');
    expect(SHOPPING_SYSTEM_PROMPT).toContain('requireTopologies');
  });

  it('SHOPPING_SYSTEM_PROMPT requires JSON-only output', () => {
    expect(SHOPPING_SYSTEM_PROMPT).toContain('valid JSON');
    expect(SHOPPING_SYSTEM_PROMPT).toContain('Do NOT include any text outside the JSON');
  });

  it('prompt version is defined', () => {
    expect(typeof PROMPT_VERSION).toBe('string');
    expect(PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('DIAGNOSIS_SYSTEM_PROMPT and GENERAL_SYSTEM_PROMPT exist', () => {
    expect(typeof DIAGNOSIS_SYSTEM_PROMPT).toBe('string');
    expect(DIAGNOSIS_SYSTEM_PROMPT.length).toBeGreaterThan(10);
    expect(typeof GENERAL_SYSTEM_PROMPT).toBe('string');
    expect(GENERAL_SYSTEM_PROMPT.length).toBeGreaterThan(10);
  });
});

// ── Tests: Non-shopping modes ────────────────────────────

describe('Non-shopping modes still work', () => {

  it('diagnosis mode returns valid stub', async () => {
    const input = makeShoppingInput({ mode: 'diagnosis' });
    const output = await runAudioXXAssistant(input);
    expect(output.structured.type).toBe('diagnosis_response');
    expect(output.debug.mode).toBe('diagnosis');
  });

  it('onboarding mode returns stub with question', async () => {
    const input = makeShoppingInput({ mode: 'onboarding' });
    const output = await runAudioXXAssistant(input);
    expect(output.structured.type).toBe('onboarding_question');
    if (output.structured.type === 'onboarding_question') {
      expect(output.structured.data.question).toBeTruthy();
    }
  });

  it('general mode returns valid stub', async () => {
    const input = makeShoppingInput({ mode: 'general' });
    const output = await runAudioXXAssistant(input);
    expect(output.structured.type).toBe('general_response');
  });
});
