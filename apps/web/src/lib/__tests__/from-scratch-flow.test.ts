/**
 * Tests: fromScratch persistence in onboarding → shopping flow.
 *
 * Validates that once a user confirms "starting from scratch",
 * no subsequent turn asks about existing system/gear ownership.
 */
import { describe, it, expect } from 'vitest';
import {
  detectInitialMode,
  transition,
  type ConvState,
} from '../conversation-state';
import { detectIntent } from '../intent';

// ── Helpers ─────────────────────────────────────────────

function contextFor(text: string) {
  const { intent, subjectMatches } = detectIntent(text);
  return {
    hasSystem: subjectMatches.length >= 2,
    subjectCount: subjectMatches.length,
    detectedIntent: intent,
  };
}

// ── Core flow: music → speakers → starting from scratch ─

describe('fromScratch: onboarding → shopping skips system question', () => {
  let convState: ConvState;

  it('Turn 1: music description → music_input/awaiting_listening_path', () => {
    const text = 'I listen to jazz and classical';
    const ctx = contextFor(text);
    const state = detectInitialMode(text, ctx);

    expect(state).not.toBeNull();
    expect(state!.mode).toBe('music_input');
    expect(state!.stage).toBe('awaiting_listening_path');
    convState = state!;
  });

  it('Turn 2: "speakers" → asks about existing gear (fromScratch not yet set)', () => {
    const text = 'speakers';
    const result = transition(convState, text, contextFor(text));

    // Should ask about existing gear since fromScratch isn't set yet
    expect(result.state.mode).toBe('music_input');
    expect(result.state.stage).toBe('awaiting_onboarding_followup');
    if (result.response?.kind === 'note') {
      expect(result.response.content).toMatch(/already have|starting from scratch/i);
    }
    convState = result.state;
  });

  it('Turn 3: "starting from scratch" → sets fromScratch, asks budget ONLY', () => {
    const text = 'starting from scratch';
    const result = transition(convState, text, contextFor(text));

    // Should transition to shopping/clarify_budget
    expect(result.state.mode).toBe('shopping');
    expect(result.state.stage).toBe('clarify_budget');
    expect(result.state.facts.fromScratch).toBe(true);

    // The question must be about budget, NOT about existing system
    if (result.response?.kind === 'question') {
      expect(result.response.question).toMatch(/budget/i);
      expect(result.response.question).not.toMatch(/existing system|gear you want to improve/i);
    }
    convState = result.state;
  });

  it('Turn 4: budget → ready_to_recommend (no system question)', () => {
    const text = 'around $1000';
    const result = transition(convState, text, contextFor(text));

    expect(result.state.mode).toBe('shopping');
    expect(result.state.stage).toBe('ready_to_recommend');
    expect(result.state.facts.fromScratch).toBe(true);
    expect(result.state.facts.budget).toBeTruthy();
  });
});

// ── fromScratch declared early: skip ownership question entirely ─

describe('fromScratch: early declaration skips ownership question', () => {
  let convState: ConvState;

  it('Turn 1: music + fromScratch → music_input', () => {
    const text = "I'm starting from scratch, I love electronic music";
    const ctx = contextFor(text);
    const state = detectInitialMode(text, ctx);

    expect(state).not.toBeNull();
    expect(state!.facts.fromScratch).toBe(true);
    convState = state!;
  });

  it('Turn 2: "speakers" → skips ownership, goes to clarify_budget', () => {
    const text = 'speakers';
    const result = transition(convState, text, contextFor(text));

    // With fromScratch already set, should skip the ownership question
    // and go directly to budget
    expect(result.state.facts.fromScratch).toBe(true);

    // Should NOT be in awaiting_onboarding_followup (which asks the ownership question)
    if (result.state.mode === 'music_input') {
      // If still in music_input, it should NOT ask about existing gear
      expect(result.state.stage).not.toBe('awaiting_onboarding_followup');
    } else {
      // Ideal: jumped straight to shopping/clarify_budget
      expect(result.state.mode).toBe('shopping');
      expect(result.state.stage).toBe('clarify_budget');
    }
  });
});

// ── clarify_category → clarify_budget respects fromScratch ─

describe('fromScratch: clarify_category → clarify_budget question', () => {
  it('with fromScratch, budget question omits system mention', () => {
    const state: ConvState = {
      mode: 'shopping',
      stage: 'clarify_category',
      facts: { fromScratch: true },
    };
    const text = 'speakers';
    const result = transition(state, text, contextFor(text));

    expect(result.state.stage).toBe('clarify_budget');
    if (result.response?.kind === 'question') {
      expect(result.response.question).toMatch(/budget/i);
      expect(result.response.question).not.toMatch(/existing system|gear.*work with/i);
    }
  });

  it('without fromScratch, budget question mentions system', () => {
    const state: ConvState = {
      mode: 'shopping',
      stage: 'clarify_category',
      facts: {},
    };
    const text = 'speakers';
    const result = transition(state, text, contextFor(text));

    expect(result.state.stage).toBe('clarify_budget');
    if (result.response?.kind === 'question') {
      expect(result.response.question).toMatch(/existing system|gear.*work with/i);
    }
  });
});

// ── No system ownership question once fromScratch is set ─

describe('fromScratch: never re-asks about existing system', () => {
  it('no response in any shopping stage contains system ownership question when fromScratch=true', () => {
    const stages = ['clarify_category', 'clarify_budget'] as const;

    for (const stage of stages) {
      const state: ConvState = {
        mode: 'shopping',
        stage,
        facts: { fromScratch: true, category: 'speaker' },
      };
      const result = transition(state, 'not sure', contextFor('not sure'));

      if (result.response?.kind === 'question') {
        expect(result.response.question).not.toMatch(
          /do you already have|existing.*system|gear you want to improve/i,
        );
      }
      if (result.response?.kind === 'note') {
        expect(result.response.content).not.toMatch(
          /do you already have|existing.*system|gear you want to improve/i,
        );
      }
    }
  });
});
