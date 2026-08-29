/**
 * GTM Phase 4 — "no turn may end empty" regression coverage.
 *
 * Thirteen benchmark reds (audit-2026-07-14) shared one mechanism:
 * a lane terminated with no substantive user-visible response. The
 * dispatcher now falls through to the knowledge lane at those points.
 *
 * These tests pin the GUARD CONDITIONS at the engine level for all 13
 * IDs: each test asserts (a) the pre-guard state is genuinely empty for
 * that prompt, and (b) the guard predicate that page.tsx now checks
 * fires. Populated-lane tests assert the guards do NOT fire.
 */
import { describe, it, expect } from 'vitest';
import { detectIntent, respondToMusicInput, MUSIC_INPUT_FALLBACK } from '../intent';
import { buildTurnContext } from '../turn-context';
import { buildSystemAssessment, buildConsultationResponse } from '../consultation';
import { detectShoppingIntent, buildShoppingAnswer } from '../shopping-intent';
import { reason } from '../reasoning';
import type { AudioSessionState } from '../system-types';
import type { ExtractedSignals } from '../signal-types';

const GUEST: AudioSessionState = {
  activeSystemRef: { kind: 'none' } as AudioSessionState['activeSystemRef'],
  savedSystems: [],
  draftSystem: null,
  loading: false,
  proposedSystem: null,
};
const EMPTY_SIGNALS: ExtractedSignals = {
  traits: {},
  symptoms: [],
  archetype_hints: [],
  uncertainty_level: 0.5,
  matched_phrases: [],
  matched_uncertainty_markers: [],
};

const QUESTION_SHAPED = (t: string) =>
  /\?\s*$/.test(t.trim())
  || /^(?:do|does|is|are|can|could|should|what|whats|what's|why|how|which|when|where)\b/i.test(t.trim());

const MUSIC_QUESTION_SHAPED = (t: string) =>
  /\?\s*$/.test(t.trim())
  || /^(?:do|does|is|are|can|could|should|what|whats|what's|why|how|which|when|where)\b/i.test(t.trim())
  || /\b(?:where do i start|how do i|should i|worth it)\b/i.test(t);

describe('music_input guard — questions fall to knowledge lane, descriptions keep onboarding', () => {
  // PH-03, RS-02, CN-06, VG-09: questions containing music words
  // false-positive the matcher ("vinyl" → "warm, textured, analog
  // music" note) — a non-answer. The guard keys on question shape.
  const CASES = [
    'Is streaming as good as vinyl?',
    'Do I need acoustic panels in a 12x14 room?',
    'why does vinyl sound better',
    'thinking about getting into vinyl, where do i start',
  ];
  for (const prompt of CASES) {
    it(`"${prompt}" — question-shaped → guard fires`, () => {
      expect(detectIntent(prompt).intent).toBe('music_input');
      expect(MUSIC_QUESTION_SHAPED(prompt)).toBe(true);
    });
  }

  it('a real music description keeps the onboarding flow', () => {
    const desc = 'I mostly listen to jazz and classic rock';
    expect(MUSIC_QUESTION_SHAPED(desc)).toBe(false);
    expect(respondToMusicInput(desc)).not.toBe(MUSIC_INPUT_FALLBACK);
  });
});

describe('intake guard — question-shaped messages get answers, not questionnaires', () => {
  // BG-06
  it('"do I need a DAC if my amp has one built in" → guard fires', () => {
    const prompt = 'do I need a DAC if my amp has one built in';
    expect(detectIntent(prompt).intent).toBe('intake');
    expect(QUESTION_SHAPED(prompt)).toBe(true);
  });

  it('a vague want keeps the intake questionnaire', () => {
    expect(QUESTION_SHAPED('I want a new stereo for my living room')).toBe(false);
  });
});

describe('consultation-null guard — engine emptiness confirmed for the dead-end reds', () => {
  // BG-05, VG-02, EC-01, SA-08: the curated layer produces nothing, so
  // page.tsx's terminal (after LLM product inference) now runs the
  // knowledge lane instead of the hedged apology.
  const CASES = [
    'whats the difference between an integrated amp and a receiver', // BG-05
    'harbeht or proac for classical?',                               // VG-02
    'Assess my system: Fooblaster 9000, Sonic Deathray Mk II',       // EC-01
  ];
  for (const prompt of CASES) {
    it(`"${prompt}" — consultation returns null`, () => {
      const turnCtx = buildTurnContext(prompt, GUEST, new Set(), undefined);
      expect(buildConsultationResponse(prompt, turnCtx.subjectMatches)).toBeNull();
    });
  }

  it('SA-08 (Genelec/RME) — parser generalization now assesses it (guard correctly does not fire)', () => {
    /*
     * Re-pinned (campaign, 2026-08-29): the leftover-segment pass now
     * surfaces Genelec/RME as components, so the engine produces a real
     * assessment instead of the old dead-end null. The guard's job — never
     * fire when substance exists — is unchanged.
     */
    const turnCtx = buildTurnContext('Assess my system: RME ADI-2 DAC, Genelec 8341A monitors', GUEST, new Set(), undefined);
    const r = buildSystemAssessment('Assess my system: RME ADI-2 DAC, Genelec 8341A monitors', turnCtx.subjectMatches, turnCtx.activeSystem, []);
    expect(r).not.toBeNull();
  });
});

describe('shopping guard — zero-product answers fall to knowledge lane', () => {
  // PD-04, CG-04, LS-02, LS-03
  const EMPTY_CASES = [
    'Is the Eversolo A8 worth it over the A6?',                        // PD-04
    'What should I upgrade first with $800: Bluesound Node, Cambridge CXA81, or KEF Q350?', // CG-04
    'best soundbar for a small apartment',                             // LS-02
    'are AirPods Max worth it',                                        // LS-03
  ];
  for (const prompt of EMPTY_CASES) {
    it(`"${prompt.slice(0, 50)}" — shopping produces zero products → guard fires`, () => {
      const ctx = detectShoppingIntent(prompt, EMPTY_SIGNALS);
      const reasoning = reason(prompt, [], EMPTY_SIGNALS, null, ctx, null);
      const answer: any = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, reasoning);
      expect((answer.productExamples ?? []).length).toBe(0);
    });
  }

  it('a populated shopping answer does not trigger the guard', () => {
    const prompt = 'best DAC under $1000';
    const ctx = detectShoppingIntent(prompt, EMPTY_SIGNALS);
    const reasoning = reason(prompt, [], EMPTY_SIGNALS, null, ctx, null);
    const answer: any = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, reasoning);
    expect((answer.productExamples ?? []).length).toBeGreaterThan(0);
  });
});
