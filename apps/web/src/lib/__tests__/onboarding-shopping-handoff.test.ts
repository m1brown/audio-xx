/**
 * Onboarding → shopping handoff tests.
 *
 * Validates the multi-turn from-scratch flow:
 *   1. "i like van halen" → music_input, awaiting_listening_path
 *   2. "speakers" → music_input, awaiting_onboarding_followup
 *   3. "starting from scratch" → shopping, clarify_budget (with fromScratch flag)
 *   4. "<budget>" → shopping, ready_to_recommend (with synthesizedQuery including "from scratch")
 *
 * Budget variants: "$5000", "5000", "budget is 5000", "2,000", "under 3000"
 *
 * Cross-category: headphones, amplifier, DAC, turntable
 *
 * System-question suppression: from-scratch users must never see "What's in your system?"
 */

import { describe, it, expect } from 'vitest';
import {
  type ConvState,
  INITIAL_CONV_STATE,
  transition,
  detectInitialMode,
} from '../conversation-state';
import { detectIntent } from '../intent';
import { detectShoppingIntent, getShoppingClarification, getStatedGaps } from '../shopping-intent';
import type { ExtractedSignals } from '../signal-types';

/** Minimal valid signals object for shopping tests. */
const EMPTY_SIGNALS: ExtractedSignals = {
  traits: {},
  symptoms: [],
  archetype_hints: [],
  uncertainty_level: 0,
  matched_phrases: [],
  matched_uncertainty_markers: [],
};

/** Helper: run detectInitialMode for the first turn. */
function startConversation(text: string): ConvState {
  const { intent } = detectIntent(text);
  const result = detectInitialMode(text, {
    detectedIntent: intent,
    hasSystem: false,
    subjectCount: 0,
  });
  expect(result).not.toBeNull();
  return result!;
}

/** Helper: run transition for a subsequent turn. */
function nextTurn(state: ConvState, text: string) {
  const { intent } = detectIntent(text);
  return transition(state, text, {
    hasSystem: false,
    subjectCount: 0,
    detectedIntent: intent,
  });
}

// ══════════════════════════════════════════════════════
// CORE SPEAKER FLOW
// ══════════════════════════════════════════════════════

describe('Onboarding → shopping handoff (speakers)', () => {
  it('turn 1: music input → awaiting_listening_path', () => {
    const state = startConversation('i like van halen');
    expect(state.mode).toBe('music_input');
    expect(state.stage).toBe('awaiting_listening_path');
    expect(state.facts.musicDescription).toBe('i like van halen');
  });

  it('turn 2: "speakers" → awaiting_onboarding_followup', () => {
    const state = startConversation('i like van halen');
    const turn2 = nextTurn(state, 'speakers');
    expect(turn2.state.mode).toBe('music_input');
    expect(turn2.state.stage).toBe('awaiting_onboarding_followup');
    expect(turn2.state.facts.listeningPath).toBe('speakers');
    expect(turn2.state.facts.category).toBe('speaker');
    expect(turn2.response).not.toBeNull();
    expect(turn2.response!.kind).toBe('note');
  });

  it('turn 3: "starting from scratch" → shopping/clarify_budget with fromScratch', () => {
    const state = startConversation('i like van halen');
    const turn2 = nextTurn(state, 'speakers');
    const turn3 = nextTurn(turn2.state, 'starting from scratch');
    expect(turn3.state.mode).toBe('shopping');
    expect(turn3.state.stage).toBe('clarify_budget');
    expect(turn3.state.facts.fromScratch).toBe(true);
    expect(turn3.response).not.toBeNull();
    expect(turn3.response!.kind).toBe('question');
    // Must preserve music context
    expect(turn3.state.facts.musicDescription).toBe('i like van halen');
    expect(turn3.state.facts.listeningPath).toBe('speakers');
  });

  const BUDGET_VARIANTS = [
    { input: '$5000', label: 'dollar-prefixed' },
    { input: '5000', label: 'plain number' },
    { input: 'budget is 5000', label: 'budget is X' },
    { input: '2,000', label: 'comma-formatted' },
    { input: 'under 3000', label: 'under X' },
  ];

  for (const { input, label } of BUDGET_VARIANTS) {
    it(`turn 4: "${input}" (${label}) → ready_to_recommend with synthesizedQuery`, () => {
      const state = startConversation('i like van halen');
      const turn2 = nextTurn(state, 'speakers');
      const turn3 = nextTurn(turn2.state, 'starting from scratch');
      const turn4 = nextTurn(turn3.state, input);

      expect(turn4.state.facts.budget).toBeTruthy();
      expect(turn4.state.stage).toBe('ready_to_recommend');
      expect(turn4.response).not.toBeNull();
      expect(turn4.response!.kind).toBe('proceed');
      if (turn4.response!.kind === 'proceed') {
        expect(turn4.response!.synthesizedQuery).toBeTruthy();
        expect(turn4.response!.synthesizedQuery).toMatch(/van halen/i);
        expect(turn4.response!.synthesizedQuery).toMatch(/speakers/i);
        // Must carry from-scratch signal for downstream shopping pipeline
        expect(turn4.response!.synthesizedQuery).toMatch(/from scratch/i);
      }
    });
  }
});

// ══════════════════════════════════════════════════════
// HEADPHONES FLOW
// ══════════════════════════════════════════════════════

describe('Onboarding → shopping handoff (headphones)', () => {
  it('full flow: jazz → headphones → from scratch → 500', () => {
    const state = startConversation('i listen to jazz');
    const turn2 = nextTurn(state, 'headphones');
    expect(turn2.state.facts.listeningPath).toBe('headphones');
    expect(turn2.state.facts.category).toBe('headphone');

    const turn3 = nextTurn(turn2.state, 'starting fresh');
    expect(turn3.state.mode).toBe('shopping');
    expect(turn3.state.stage).toBe('clarify_budget');
    expect(turn3.state.facts.fromScratch).toBe(true);

    const turn4 = nextTurn(turn3.state, '500');
    expect(turn4.state.facts.budget).toBeTruthy();
    expect(turn4.state.stage).toBe('ready_to_recommend');
    if (turn4.response!.kind === 'proceed') {
      expect(turn4.response!.synthesizedQuery).toMatch(/jazz/i);
      expect(turn4.response!.synthesizedQuery).toMatch(/headphones/i);
      expect(turn4.response!.synthesizedQuery).toMatch(/from scratch/i);
    }
  });
});

// ══════════════════════════════════════════════════════
// CROSS-CATEGORY: direct shopping entry (non-music_input)
// ══════════════════════════════════════════════════════

describe('Direct shopping from-scratch flow (non-music entry)', () => {
  const CATEGORIES: Array<{ entry: string; category: string; label: string }> = [
    { entry: 'I want to buy an amplifier', category: 'amplifier', label: 'amplifier' },
    { entry: 'looking to buy a DAC', category: 'dac', label: 'DAC' },
    { entry: 'I want to buy a turntable', category: 'turntable', label: 'turntable' },
    { entry: 'I want to buy speakers', category: 'speaker', label: 'speakers' },
  ];

  for (const { entry, category, label } of CATEGORIES) {
    it(`${label}: entry → clarify_budget → "5000" → ready_to_recommend`, () => {
      const state = startConversation(entry);
      // Should route to shopping — either ready_to_recommend or clarify_budget
      expect(state.mode).toBe('shopping');

      // If already ready (explicit purchase intent), that's fine too
      if (state.stage === 'ready_to_recommend') return;

      expect(state.facts.category).toBe(category);

      // Provide budget
      const turn2 = nextTurn(state, '5000');
      expect(turn2.state.facts.budget).toBeTruthy();
      expect(turn2.state.stage).toBe('ready_to_recommend');
      expect(turn2.response!.kind).toBe('proceed');
    });

    it(`${label}: stays in shopping mode throughout — no diagnosis/system prompts`, () => {
      const state = startConversation(entry);
      expect(state.mode).toBe('shopping');

      // Even without system, should not ask "What's in your system?" for shopping
      if (state.stage === 'clarify_budget') {
        const turn2 = nextTurn(state, '5000');
        // Must NOT be diagnosis or ask for system
        expect(turn2.state.mode).not.toBe('diagnosis');
        expect(turn2.state.stage).not.toBe('clarify_system');
      }
    });
  }
});

// ══════════════════════════════════════════════════════
// FROM-SCRATCH SYSTEM-QUESTION SUPPRESSION
// ══════════════════════════════════════════════════════

describe('From-scratch users: no system-question in shopping response', () => {
  it('synthesized query with "from scratch" triggers build-a-system mode', () => {
    const synthesized = 'I listen to van halen. Looking for speakers under $5000. Starting from scratch.';
    const ctx = detectShoppingIntent(synthesized, EMPTY_SIGNALS, undefined);
    expect(ctx.mode).toBe('build-a-system');
  });

  it('build-a-system mode has no system gap in getStatedGaps', () => {
    const synthesized = 'I listen to van halen. Looking for speakers under $5000. Starting from scratch.';
    const ctx = detectShoppingIntent(synthesized, EMPTY_SIGNALS, undefined);
    const gaps = getStatedGaps(ctx, EMPTY_SIGNALS);
    expect(gaps).not.toContain('system');
  });

  it('build-a-system mode does not ask for system in getShoppingClarification', () => {
    const synthesized = 'I listen to van halen. Looking for speakers under $5000. Starting from scratch.';
    const ctx = detectShoppingIntent(synthesized, EMPTY_SIGNALS, undefined);
    const question = getShoppingClarification(ctx, EMPTY_SIGNALS, 1, false);
    if (question) {
      expect(question).not.toMatch(/what.*in your system/i);
      expect(question).not.toMatch(/existing system/i);
    }
  });
});

// ══════════════════════════════════════════════════════
// BUDGET EXTRACTION (direct unit tests)
// ══════════════════════════════════════════════════════

describe('Budget extraction in clarify_budget context', () => {
  it('accepts "5000" as budget', () => {
    const state: ConvState = {
      mode: 'shopping',
      stage: 'clarify_budget',
      facts: { category: 'speaker' },
    };
    const result = transition(state, '5000', { hasSystem: false, subjectCount: 0 });
    expect(result.state.facts.budget).toBeTruthy();
    expect(result.state.stage).toBe('ready_to_recommend');
  });

  it('accepts "$3,500" as budget', () => {
    const state: ConvState = {
      mode: 'shopping',
      stage: 'clarify_budget',
      facts: { category: 'dac' },
    };
    const result = transition(state, '$3,500', { hasSystem: false, subjectCount: 0 });
    expect(result.state.facts.budget).toBeTruthy();
    expect(result.state.stage).toBe('ready_to_recommend');
  });

  it('accepts "around 2000" contextually', () => {
    const state: ConvState = {
      mode: 'shopping',
      stage: 'clarify_budget',
      facts: { category: 'speaker' },
    };
    const result = transition(state, 'around 2000', { hasSystem: false, subjectCount: 0 });
    expect(result.state.facts.budget).toBeTruthy();
    expect(result.state.stage).toBe('ready_to_recommend');
  });

  it('does NOT accept "yes" or "ok" as budget', () => {
    const state: ConvState = {
      mode: 'shopping',
      stage: 'clarify_budget',
      facts: { category: 'speaker' },
    };
    const result = transition(state, 'yes', { hasSystem: false, subjectCount: 0 });
    expect(result.state.facts.budget).toBeFalsy();
    expect(result.state.stage).toBe('clarify_budget');
  });
});

// ══════════════════════════════════════════════════════
// FROM-SCRATCH SIGNAL DETECTION
// ══════════════════════════════════════════════════════

describe('From-scratch signal detection', () => {
  const FROM_SCRATCH_PHRASES = [
    'starting from scratch',
    'starting fresh',
    'starting new',
    "don't have any",
    'no system',
    'no gear',
    'first system',
    'building new',
    'brand new',
  ];

  for (const phrase of FROM_SCRATCH_PHRASES) {
    it(`detects "${phrase}" as fromScratch`, () => {
      const state: ConvState = {
        mode: 'music_input',
        stage: 'awaiting_onboarding_followup',
        facts: { musicDescription: 'i like jazz', listeningPath: 'speakers', category: 'speaker' },
      };
      const result = transition(state, phrase, { hasSystem: false, subjectCount: 0 });
      expect(result.state.facts.fromScratch).toBe(true);
    });
  }
});
