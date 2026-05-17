/**
 * QA C2 — non-advisory intents must not be force-routed into advisory framing.
 *
 * Three failure modes existed before the fix:
 *   1. greeting / educational intents falling through to the
 *      consultation / shopping / diagnosis pipelines once the
 *      conversation moved past the state-machine orientation handler.
 *   2. The shopping-lock at page.tsx:1745 clobbering any non-advisory
 *      intent to 'shopping' mid-session (audio_knowledge, audio_assistant,
 *      greeting, educational all consumed as recommendation refinements).
 *   3. The shopping-mode override at page.tsx:2318 doing the same.
 *
 * The fix:
 *   - A typed helper `isNonAdvisoryIntent(intent)` in intent.ts marks
 *     the four intents that own their own direct response handler
 *     (audio_knowledge, audio_assistant, greeting, educational).
 *     Glossary is handled separately by checkGlossaryQuestion.
 *   - page.tsx adds an early bypass for greeting/educational once
 *     the state-machine orientation handler has been passed; the two
 *     shopping overrides now exempt isNonAdvisoryIntent(intent) so
 *     audio_knowledge / audio_assistant reach their downstream
 *     handlers intact.
 *
 * These tests cover the contract at the intent / router layer.
 * page.tsx behavior is covered indirectly by the existing routing
 * regression bundle (shopping-lock, comparison-followup, etc.) —
 * those tests would fail if the shopping override exemption broke
 * a real advisory path.
 */

import { describe, it, expect } from 'vitest';
import {
  detectIntent,
  isNonAdvisoryIntent,
  NON_ADVISORY_INTENTS,
  type UserIntent,
} from '../intent';
import { routeConversation } from '../conversation-router';

// ── isNonAdvisoryIntent contract ─────────────────────────

describe('QA C2 — isNonAdvisoryIntent flags the four direct-handler intents', () => {
  it('flags the four intents that have their own handlers', () => {
    expect(isNonAdvisoryIntent('audio_knowledge')).toBe(true);
    expect(isNonAdvisoryIntent('audio_assistant')).toBe(true);
    expect(isNonAdvisoryIntent('greeting')).toBe(true);
    expect(isNonAdvisoryIntent('educational')).toBe(true);
  });

  it('does NOT flag the advisory intents (shopping/diagnosis/comparison/etc.)', () => {
    const advisory: UserIntent[] = [
      'gear_inquiry',
      'shopping',
      'comparison',
      'diagnosis',
      'system_assessment',
      'consultation_entry',
      'cable_advisory',
      'product_assessment',
      'exploration',
      'intake',
      'music_input',
    ];
    for (const i of advisory) {
      expect(isNonAdvisoryIntent(i)).toBe(false);
    }
  });

  it('handles undefined / empty / unknown gracefully (no false positive)', () => {
    expect(isNonAdvisoryIntent(undefined)).toBe(false);
    expect(isNonAdvisoryIntent('')).toBe(false);
    expect(isNonAdvisoryIntent('something_made_up')).toBe(false);
  });

  it('exports the set as readonly with exactly the four intents', () => {
    expect(NON_ADVISORY_INTENTS.size).toBe(4);
    expect(NON_ADVISORY_INTENTS.has('audio_knowledge' as UserIntent)).toBe(true);
    expect(NON_ADVISORY_INTENTS.has('audio_assistant' as UserIntent)).toBe(true);
    expect(NON_ADVISORY_INTENTS.has('greeting' as UserIntent)).toBe(true);
    expect(NON_ADVISORY_INTENTS.has('educational' as UserIntent)).toBe(true);
  });
});

// ── Greeting does not classify as advisory ──────────────

describe('QA C2 — greeting / educational classification', () => {
  const GREETINGS = ['hi', 'hello', 'hey', 'good morning'];

  it.each(GREETINGS)('detectIntent classifies %p as greeting', (text) => {
    const { intent } = detectIntent(text);
    expect(intent).toBe('greeting');
    expect(isNonAdvisoryIntent(intent)).toBe(true);
  });

  it('educational opener "what is audio xx" classifies as educational', () => {
    const { intent } = detectIntent('what is audio xx');
    // The exact intent depends on the educational/knowledge boundary;
    // either is non-advisory and acceptable for C2.
    expect(['educational', 'audio_knowledge', 'greeting']).toContain(intent);
    expect(isNonAdvisoryIntent(intent)).toBe(true);
  });
});

// ── Knowledge / explanatory question routes to audio_knowledge ─

describe('QA C2 — knowledge / explanatory questions classify as audio_knowledge', () => {
  // These inputs match AUDIO_KNOWLEDGE_PATTERNS — they're the
  // knowledge-shaped questions Audio XX is supposed to answer
  // directly. The C2 contract: when detectIntent labels a turn as
  // audio_knowledge, isNonAdvisoryIntent agrees so the shopping
  // overrides exempt it and the audio_knowledge lane handler runs.
  it('"what is R2R?" classifies as audio_knowledge (non-advisory)', () => {
    const { intent } = detectIntent('what is R2R?');
    expect(intent).toBe('audio_knowledge');
    expect(isNonAdvisoryIntent(intent)).toBe(true);
  });

  it('"what are the pros and cons of tubes?" classifies as audio_knowledge', () => {
    const { intent } = detectIntent('what are the pros and cons of tubes?');
    expect(intent).toBe('audio_knowledge');
    expect(isNonAdvisoryIntent(intent)).toBe(true);
  });
});

// ── Real advisory questions still route normally ─────────

describe('QA C2 — real advisory intents are untouched', () => {
  it('"best DAC under $1000" still routes to shopping', () => {
    const { intent } = detectIntent('best DAC under $1000');
    expect(intent).toBe('shopping');
    expect(isNonAdvisoryIntent(intent)).toBe(false);
  });

  it('"Chord vs Denafrips" still routes to comparison', () => {
    const { intent } = detectIntent('Chord vs Denafrips');
    expect(intent).toBe('comparison');
    expect(isNonAdvisoryIntent(intent)).toBe(false);
  });

  it('"my system sounds bright" still routes to diagnosis', () => {
    const { intent } = detectIntent('my system sounds bright');
    expect(intent).toBe('diagnosis');
    expect(isNonAdvisoryIntent(intent)).toBe(false);
  });

  it('"thoughts on Denafrips Pontus" still routes to gear_inquiry / consultation', () => {
    const { intent } = detectIntent('thoughts on Denafrips Pontus');
    expect(isNonAdvisoryIntent(intent)).toBe(false);
    // The exact handler depends on subjectMatch resolution; the contract
    // here is that it's NOT a non-advisory bypass candidate.
  });
});

// ── System / comparison / diagnosis intents are NOT bypassed ───

describe('QA C2 — assessment / comparison / diagnosis intents are not bypassed', () => {
  const STRONG_ADVISORY: UserIntent[] = [
    'system_assessment',
    'product_assessment',
    'comparison',
    'diagnosis',
    'consultation_entry',
    'cable_advisory',
    'exploration',
    'intake',
    'music_input',
    'gear_inquiry',
    'shopping',
  ];
  it.each(STRONG_ADVISORY)('%s is not in NON_ADVISORY_INTENTS', (i) => {
    expect(NON_ADVISORY_INTENTS.has(i)).toBe(false);
    expect(isNonAdvisoryIntent(i)).toBe(false);
  });
});

// ── Router does not pre-empt non-advisory intents ──────

describe('QA C2 — conversation-router output is orthogonal to non-advisory bypass', () => {
  // The router operates on text patterns and returns one of four modes.
  // The non-advisory bypass operates on `intent`, not on router mode.
  // These tests guard the contract that the router does not invent a
  // mode that would force a non-advisory message into shopping or
  // diagnosis: a bare greeting should not classify as 'shopping' or
  // 'diagnosis' by the router either.
  it('"hi" does not route to shopping or diagnosis', () => {
    const mode = routeConversation('hi');
    expect(['shopping', 'diagnosis']).not.toContain(mode);
  });

  it('"what does soundstage mean?" does not route to shopping or diagnosis', () => {
    const mode = routeConversation('what does soundstage mean?');
    expect(['shopping', 'diagnosis']).not.toContain(mode);
  });
});
