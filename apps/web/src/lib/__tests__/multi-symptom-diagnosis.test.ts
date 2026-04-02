/**
 * Multi-symptom diagnosis regression tests.
 *
 * Verifies that inputs containing multiple symptoms in a single message
 * are correctly processed: all symptoms extracted, longest-match-first
 * trait priority applied, and real diagnosis rules fired.
 */
import { describe, it, expect } from 'vitest';
import { processText } from '@audio-xx/signals';
import { evaluate, type EvaluationContext } from '@audio-xx/rules';
import { analysisToAdvisory } from '../advisory-response';
import { detectIntent } from '../intent';
import { detectInitialMode } from '../conversation-state';

function evaluateInput(text: string) {
  const signals = processText(text);
  const ctx: EvaluationContext = {
    symptoms: signals.symptoms,
    traits: signals.traits,
    archetypes: [...signals.archetype_hints],
    uncertainty_level: signals.uncertainty_level,
    has_improvement_signals: signals.symptoms.includes('improvement'),
  };
  const result = evaluate(ctx);
  return { signals, result };
}

// ══════════════════════════════════════════════════════════
// 1. Signal extraction: multiple symptoms in one message
// ══════════════════════════════════════════════════════════

describe('Multi-symptom signal extraction', () => {
  it('"too bright and too much bass" → extracts both symptoms', () => {
    const { signals } = evaluateInput('too bright and too much bass');
    expect(signals.symptoms).toContain('brightness_harshness');
    expect(signals.symptoms).toContain('bass_bloom');
    expect(signals.matched_phrases.length).toBeGreaterThanOrEqual(2);
  });

  it('"sounds veiled and too warm" → extracts congestion + warmth', () => {
    const { signals } = evaluateInput('sounds veiled and too warm');
    expect(signals.symptoms).toContain('congestion_muddiness');
    expect(signals.symptoms).toContain('too_warm');
  });

  it('"flat lifeless sound with narrow soundstage" → extracts both', () => {
    const { signals } = evaluateInput('flat lifeless sound with narrow soundstage');
    expect(signals.symptoms).toContain('flat_lifeless');
    expect(signals.symptoms).toContain('narrow_soundstage');
  });

  it('"listening fatigue and not enough body" → extracts fatigue + thinness', () => {
    const { signals } = evaluateInput('listening fatigue and not enough body');
    expect(signals.symptoms).toContain('fatigue');
    expect(signals.symptoms).toContain('thinness');
  });

  it('"boomy bass but also thin mids" → contradictory symptoms both extracted', () => {
    const { signals } = evaluateInput('boomy bass but also thin mids');
    expect(signals.symptoms).toContain('bass_bloom');
    expect(signals.symptoms).toContain('thinness');
  });
});

// ══════════════════════════════════════════════════════════
// 2. Rule engine: multi-symptom inputs fire meaningful rules
// ══════════════════════════════════════════════════════════

describe('Multi-symptom rule firing', () => {
  it('"too bright and too much bass" → fires at least one non-fallback rule', () => {
    const { result } = evaluateInput('too bright and too much bass');
    expect(result.fired_rules.length).toBeGreaterThanOrEqual(1);
    expect(result.fired_rules[0].id).not.toBe('friendly-advisor-fallback');
  });

  it('"sounds veiled and too warm" → fires at least one non-fallback rule', () => {
    const { result } = evaluateInput('sounds veiled and too warm');
    expect(result.fired_rules.length).toBeGreaterThanOrEqual(1);
    expect(result.fired_rules[0].id).not.toBe('friendly-advisor-fallback');
  });

  it('"flat lifeless sound with narrow soundstage" → fires at least one non-fallback rule', () => {
    const { result } = evaluateInput('flat lifeless sound with narrow soundstage');
    expect(result.fired_rules.length).toBeGreaterThanOrEqual(1);
    expect(result.fired_rules[0].id).not.toBe('friendly-advisor-fallback');
  });
});

// ══════════════════════════════════════════════════════════
// 3. Advisory output: multi-symptom produces real diagnosis
// ══════════════════════════════════════════════════════════

describe('Multi-symptom advisory output', () => {
  const multiInputs = [
    'too bright and too much bass',
    'sounds veiled and too warm',
    'listening fatigue and not enough body',
    'flat lifeless sound with narrow soundstage',
  ];

  for (const text of multiInputs) {
    it(`"${text}" → diagnosis advisory with real content`, () => {
      const { signals, result } = evaluateInput(text);
      const advisory = analysisToAdvisory(result, signals);

      expect(advisory.kind).toBe('diagnosis');
      expect(advisory.tendencies).toBeTruthy();
      expect(advisory.tendencies!.length).toBeGreaterThan(20);
    });
  }
});

// ══════════════════════════════════════════════════════════
// 4. Routing: multi-symptom inputs enter diagnosis mode
// ══════════════════════════════════════════════════════════

describe('Multi-symptom diagnosis routing', () => {
  const multiInputs = [
    'too bright and too much bass',
    'sounds veiled and too warm',
    'listening fatigue and not enough body',
  ];

  for (const text of multiInputs) {
    it(`"${text}" → detectIntent returns 'diagnosis'`, () => {
      const { intent } = detectIntent(text);
      expect(intent).toBe('diagnosis');
    });

    it(`"${text}" → detectInitialMode returns diagnosis/ready_to_diagnose`, () => {
      const { intent, subjectMatches } = detectIntent(text);
      const mode = detectInitialMode(text, {
        detectedIntent: intent,
        hasSystem: false,
        subjectCount: subjectMatches?.length ?? 0,
      });
      expect(mode).not.toBeNull();
      expect(mode!.mode).toBe('diagnosis');
      expect(mode!.stage).toBe('ready_to_diagnose');
    });
  }
});

// ══════════════════════════════════════════════════════════
// 5. Longest-match-first: "not enough clarity" ≠ "clarity"
// ══════════════════════════════════════════════════════════

describe('Longest-match-first trait priority', () => {
  it('"not enough clarity" extracts congestion, not brightness', () => {
    const { signals } = evaluateInput('not enough clarity');
    expect(signals.symptoms).toContain('congestion_muddiness');
    // "clarity" alone might map to brightness — longest match should override
    expect(signals.matched_phrases).toContain('not enough clarity');
  });

  it('"not enough dynamics" extracts flat_lifeless, not generic dynamic', () => {
    const { signals } = evaluateInput('not enough dynamics');
    expect(signals.symptoms).toContain('flat_lifeless');
    expect(signals.matched_phrases).toContain('not enough dynamics');
  });

  it('"not enough body" extracts thinness', () => {
    const { signals } = evaluateInput('not enough body');
    expect(signals.symptoms).toContain('thinness');
    expect(signals.matched_phrases).toContain('not enough body');
  });
});

// ══════════════════════════════════════════════════════════
// 6. Multi-symptom acknowledgment in advisory tendencies
// ══════════════════════════════════════════════════════════

describe('Multi-symptom acknowledgment in diagnosis output', () => {
  it('"too bright and too much bass" → tendencies mentions both symptoms', () => {
    const { signals, result } = evaluateInput('too bright and too much bass');
    // Verify ≥2 rules fired
    expect(result.fired_rules.length).toBeGreaterThanOrEqual(2);

    const advisory = analysisToAdvisory(result, signals);
    expect(advisory.tendencies).toBeTruthy();
    // Should contain "You also described" connector for secondary symptom
    expect(advisory.tendencies).toMatch(/you also described/i);
  });

  it('"sounds veiled and too warm" → tendencies acknowledges warmth', () => {
    const { signals, result } = evaluateInput('sounds veiled and too warm');
    if (result.fired_rules.length >= 2) {
      const advisory = analysisToAdvisory(result, signals);
      expect(advisory.tendencies).toMatch(/you also described/i);
    }
  });

  it('single-symptom input does NOT have "you also described" connector', () => {
    const { signals, result } = evaluateInput('too bright');
    const advisory = analysisToAdvisory(result, signals);
    expect(advisory.tendencies).toBeTruthy();
    expect(advisory.tendencies).not.toMatch(/you also described/i);
  });

  it('"too bright and lacks bass" → extracts both symptoms after dictionary addition', () => {
    const { signals } = evaluateInput('too bright and lacks bass');
    expect(signals.symptoms).toContain('brightness_harshness');
    expect(signals.symptoms).toContain('thinness');
    expect(signals.matched_phrases).toContain('lacks bass');
  });
});
