/**
 * Intent classification — system-assessment qualifier window.
 *
 * Locks the routing fix for prompts that contain natural qualifier words
 * between the determiner (my/the/this) and the system noun
 * (system/setup/rig/chain). Before the fix, the `assess` and `evaluate`
 * patterns in SYSTEM_ASSESSMENT_PATTERNS allowed only one optional
 * intermediate word (`current`), which caused phrasings like
 *   - "the currently selected system"
 *   - "my living room system"
 *   - "my current living room system"
 * to fall through to the line-1755 default `diagnosis` intent. From
 * there, the diagnosis engine's signal extractor matched bare words
 * like "full" against signals.yaml and surfaced the
 * "I recognised 'warmth richness'..." partial-recognition message.
 *
 * Bug evidence: with an active saved system, the three reported prompts
 * all reached the diagnosis clarification flow instead of the system
 * assessment artifact path.
 *
 * Fix: widen the qualifier window for `assess` and `evaluate` patterns
 * from `(?:current\s+)?` (zero-or-one specific word) to
 * `(?:\w+\s+){0,3}` (zero-to-three arbitrary word tokens) via a shared
 * SYS_NOUN_PHRASE_FRAG. Scope is intentionally narrow: only the two
 * verb frames the failing prompts use; the other patterns in
 * SYSTEM_ASSESSMENT_PATTERNS keep their original forms.
 */

import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';

// The bug reproduces specifically when an active saved system is
// selected — the routing gate at intent.ts:1453 reads
// `options.hasActiveSavedSystem` and only routes to system_assessment
// when that flag AND assessment language are present together. The
// production submit handler in page.tsx passes this flag based on the
// AudioSessionContext active-system reference, so these tests pass it
// explicitly to match the production scenario the bug report described.
const ACTIVE_SYSTEM_OPTS = { hasActiveSavedSystem: true } as const;

describe('System-assessment qualifier window — reported prompts now classify as system_assessment', () => {
  const PROMPTS_FIXED = [
    'Evaluate the currently selected system.',
    'Give me a full assessment of my living room system.',
    'Assess my current living room system.',
  ];
  for (const text of PROMPTS_FIXED) {
    it(`"${text}" classifies as system_assessment (with active saved system)`, () => {
      const { intent } = detectIntent(text, ACTIVE_SYSTEM_OPTS);
      expect(intent).toBe('system_assessment');
    });
  }
});

describe('System-assessment qualifier window — preserved behaviour', () => {
  const PROMPTS_UNCHANGED = [
    'Evaluate my system.',
    'Assess my current system.',
  ];
  for (const text of PROMPTS_UNCHANGED) {
    it(`"${text}" still classifies as system_assessment (with active saved system)`, () => {
      const { intent } = detectIntent(text, ACTIVE_SYSTEM_OPTS);
      expect(intent).toBe('system_assessment');
    });
  }
});

describe('Diagnostic prompts must still classify as diagnosis (no over-broadening)', () => {
  // Diagnosis-language prompts must continue to route to diagnosis
  // BOTH with and without an active saved system. The DIAGNOSIS_PATTERNS
  // check at intent.ts:1417 fires before the assessment gate, so the
  // saved-system flag is irrelevant for genuine symptom language.
  const DIAGNOSTIC_PROMPTS = [
    'my system sounds bright',
    'it lacks bass',
    'the sound is harsh',
    'vocals sound thin',
  ];
  for (const text of DIAGNOSTIC_PROMPTS) {
    it(`"${text}" classifies as diagnosis (active saved system on)`, () => {
      const { intent } = detectIntent(text, ACTIVE_SYSTEM_OPTS);
      expect(intent).toBe('diagnosis');
    });
    it(`"${text}" classifies as diagnosis (no active saved system)`, () => {
      const { intent } = detectIntent(text);
      expect(intent).toBe('diagnosis');
    });
  }
});

describe('The signal-engine "warmth_richness" leak is no longer reachable for the reported prompt', () => {
  // The original bug was: `Give me a full assessment...` reached the
  // diagnosis engine's signal extractor, which matched the bare word
  // `full` against signals.yaml and asserted the symptom warmth_richness.
  // The engine then surfaced the partial-recognition fallback message.
  //
  // The fix routes the prompt as system_assessment BEFORE the diagnosis
  // engine sees it, so the signal extraction never runs and
  // warmth_richness can never be reported for this prompt. This test
  // pins the intent classification under the active-saved-system
  // condition that reproduces the bug — if it ever regresses to
  // 'diagnosis', the bug returns.
  it('the word "full" in a full-assessment request does not reach the diagnosis engine', () => {
    const { intent } = detectIntent(
      'Give me a full assessment of my living room system.',
      ACTIVE_SYSTEM_OPTS,
    );
    expect(intent).not.toBe('diagnosis');
    expect(intent).toBe('system_assessment');
  });
});
