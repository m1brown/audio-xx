/**
 * Preference-reflection routing — verifies the homepage-promise path.
 *
 * The homepage intro reads:
 *   "Audio XX helps you understand your listening preferences, find
 *    gear that fits those tastes, and build systems that work together."
 *
 * Before this lane existed, all four canonical preference-discovery
 * phrasings fell through to the diagnosis default ("what's wrong?"
 * framing) — a positioning/behaviour mismatch with the homepage promise.
 *
 * These tests pin the routing and the response shape so that mismatch
 * cannot quietly regress.
 */

import { describe, it, expect } from 'vitest';
import { detectIntent, NON_ADVISORY_INTENTS, isNonAdvisoryIntent } from '../intent';
import {
  buildPreferenceReflection,
  PREFERENCE_REFLECTION_QUESTIONS,
} from '../preference-reflection';
import {
  createDefaultProfile,
  applySignals,
  extractPreferenceSignals,
  type ListenerProfile,
} from '../listener-preferences';

// ── 1. Intent routing ────────────────────────────────────

describe('detectIntent — preference_reflection routing', () => {
  const CANONICAL_PROMPTS = [
    'Help me understand my listening preferences',
    'help me understand my listening preferences',
    "I don't know what kind of sound I like",
    'What do I seem to value based on my system?',
    'what do I actually value in a system?',
  ];

  for (const prompt of CANONICAL_PROMPTS) {
    it(`routes "${prompt}" to preference_reflection`, () => {
      const { intent } = detectIntent(prompt);
      expect(intent).toBe('preference_reflection');
    });
  }

  it('close variants also route to preference_reflection', () => {
    const variants = [
      'help me identify my listening preferences',
      'help me figure out my preferences',
      'what are my listening preferences',
      "what's my listening profile",
      'help me understand my taste',
      "I'm not sure what kind of sound I like",
      "i don't know what sound i like",
    ];
    for (const v of variants) {
      const { intent } = detectIntent(v);
      expect(intent, `prompt: "${v}"`).toBe('preference_reflection');
    }
  });

  it('does not match clear symptom / diagnosis language', () => {
    const symptomPrompts = [
      'my system sounds too bright',
      'sounds harsh and fatiguing',
      'lacks bass and warmth',
    ];
    for (const p of symptomPrompts) {
      const { intent } = detectIntent(p);
      expect(intent, `prompt: "${p}"`).toBe('diagnosis');
    }
  });

  it('does not match a shopping query', () => {
    const { intent } = detectIntent('I want to buy a DAC under $2000');
    expect(intent).not.toBe('preference_reflection');
  });

  it('preference_reflection is registered as a non-advisory intent', () => {
    expect(NON_ADVISORY_INTENTS.has('preference_reflection')).toBe(true);
    expect(isNonAdvisoryIntent('preference_reflection')).toBe(true);
  });
});

// ── 2. Response shape — low-confidence (cold start) ────────

describe('buildPreferenceReflection — low confidence', () => {
  it('asks optional questions without fabricating a profile', () => {
    const result = buildPreferenceReflection(undefined);
    // Acknowledge frames the limitation honestly.
    expect(result.acknowledge.toLowerCase()).toContain('preferences');
    expect(result.acknowledge).toMatch(/don'?t form a profile|over the course|evidence/i);
    // Does NOT claim any taste lean.
    expect(result.acknowledge.toLowerCase()).not.toMatch(
      /you (?:value|prefer|lean toward)\b|warmth and|clarity and|flow and timing/,
    );
    // Question block offers the canonical optional questions.
    for (const q of PREFERENCE_REFLECTION_QUESTIONS) {
      expect(result.question).toContain(q);
    }
    // Partial answers are explicitly fine.
    expect(result.question.toLowerCase()).toMatch(/any subset is fine|even one answer/);
  });

  it('default-confidence profile (no signals) also gets the question-led path', () => {
    const empty = createDefaultProfile();
    const result = buildPreferenceReflection(empty);
    expect(result.acknowledge).toMatch(/don'?t form a profile|over the course|evidence/i);
    for (const q of PREFERENCE_REFLECTION_QUESTIONS) {
      expect(result.question).toContain(q);
    }
  });
});

// ── 3. Response shape — meaningful profile present ─────────

describe('buildPreferenceReflection — meaningful profile', () => {
  function buildAccumulatedProfile(): ListenerProfile {
    // Seed with several strong text signals so confidence exceeds the floor
    // and renderProfileSummary returns a non-empty summary.
    const seedText =
      'I want flow and timing. Detail fatigues me. I miss body. '
      + 'I love flow and timing.';
    const signals = extractPreferenceSignals(seedText);
    return applySignals(createDefaultProfile(), signals);
  }

  it('opens with a cautious read of the emerging profile', () => {
    const profile = buildAccumulatedProfile();
    expect(profile.confidence).toBeGreaterThan(0.2);
    const result = buildPreferenceReflection(profile);
    // Cautious framing — explicitly tentative.
    expect(result.acknowledge.toLowerCase()).toMatch(/tentative|so far|sharper/);
    // Still offers the same optional refinement questions.
    for (const q of PREFERENCE_REFLECTION_QUESTIONS) {
      expect(result.question).toContain(q);
    }
  });

  it('never claims preferences for an empty / default profile', () => {
    const empty = createDefaultProfile();
    const result = buildPreferenceReflection(empty);
    // No tentative-read framing when there's nothing to read.
    expect(result.acknowledge.toLowerCase()).not.toMatch(/based on what you'?ve said so far/);
  });
});
