/**
 * QA C1 — consultation follow-up continuity.
 *
 * The defect: when a user asks a "general" follow-up to a prior
 * single-subject consultation (e.g. "interesting, tell me more",
 * "ok, what else?"), Audio XX used to re-emit the first-turn advisory
 * almost verbatim because buildConsultationFollowUp fell through to
 * buildConsultationResponse with the same subject and source data.
 *
 * The fix: replace the general-fallback rebuild with a continuity
 * acknowledgement that names the subject, lists the available next-
 * step dimensions, and asks the user to pick one. No re-emission of
 * the first-turn philosophy / tendencies / systemContext for the same
 * subject.
 *
 * Scope: these tests guard the general / catch-all branch only. The
 * four specific kinds (other_models / sonic_detail / pairing /
 * system_fit) have their own templates and are covered elsewhere
 * (phase-c-blocker-fixes.test.ts).
 */

import { describe, it, expect } from 'vitest';
import {
  buildConsultationFollowUp,
  buildConsultationResponse,
} from '../consultation';
import type { SubjectMatch } from '../intent';

// ── Helpers ──────────────────────────────────────────────

function singleBrandConsultation(brand: string, originalQuery: string) {
  return {
    subjects: [{ name: brand, kind: 'brand' as const } satisfies SubjectMatch],
    originalQuery,
  };
}

function joinAdvisoryText(r: { philosophy?: string; tendencies?: string; systemContext?: string; followUp?: string }): string {
  return [r.philosophy, r.tendencies, r.systemContext, r.followUp]
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .join(' ');
}

const GENERAL_FOLLOWUPS = [
  'interesting, tell me more',
  'ok',
  'and what else?',
  'hmm',
  'go on',
];

// ── Duplication regression guard ─────────────────────────

describe('QA C1 — general follow-up does not duplicate first-turn advisory', () => {
  it.each(GENERAL_FOLLOWUPS)(
    'general follow-up %p returns a response distinct from buildConsultationResponse on the same subject',
    (followUpMessage) => {
      const activeConsultation = singleBrandConsultation(
        'harbeth',
        'What do you think of Harbeth?',
      );

      // The first-turn advisory (what the user already saw on screen)
      const firstTurn = buildConsultationResponse(
        activeConsultation.originalQuery,
        activeConsultation.subjects,
      );
      expect(firstTurn).not.toBeNull();
      const firstTurnText = joinAdvisoryText(firstTurn!);

      const followUp = buildConsultationFollowUp(
        activeConsultation,
        followUpMessage,
        null,
      );
      expect(followUp).not.toBeNull();
      const followUpText = joinAdvisoryText(followUp!);

      // The follow-up must not be byte-equal to the first turn.
      expect(followUpText).not.toBe(firstTurnText);

      // Stronger: the bulk of the first turn must not be substring-
      // contained in the follow-up (the duplication mode was near-
      // verbatim repetition). Use the longest sentence from the first
      // turn as a duplication probe.
      const firstSentences = firstTurnText
        .split(/(?<=[.!?])\s+/)
        .filter((s) => s.length > 30);
      for (const sentence of firstSentences) {
        expect(followUpText).not.toContain(sentence);
      }
    },
  );
});

// ── Continuity-shape assertions ──────────────────────────

describe('QA C1 — general follow-up advances the conversation', () => {
  it('names the prior subject (signals continuity, not a context drop)', () => {
    const activeConsultation = singleBrandConsultation(
      'harbeth',
      'What do you think of Harbeth?',
    );
    const resp = buildConsultationFollowUp(activeConsultation, 'tell me more', null);
    expect(resp).not.toBeNull();
    const text = joinAdvisoryText(resp!).toLowerCase();
    expect(text).toContain('harbeth');
  });

  it('asks a forward-moving question rather than restating the opening', () => {
    const activeConsultation = singleBrandConsultation(
      'devore',
      'Tell me about DeVore',
    );
    const resp = buildConsultationFollowUp(activeConsultation, 'ok', null);
    expect(resp).not.toBeNull();
    expect(resp!.followUp).toBeTruthy();
    expect(resp!.followUp!.trim().endsWith('?')).toBe(true);
  });

  it('offers explicit next-step dimensions (character / pairings / fit / comparison)', () => {
    const activeConsultation = singleBrandConsultation(
      'shindo',
      'Tell me about Shindo',
    );
    const resp = buildConsultationFollowUp(activeConsultation, 'go on', null);
    expect(resp).not.toBeNull();
    const text = joinAdvisoryText(resp!).toLowerCase();
    // At least two of the four dimensions should be mentioned so the
    // user has a concrete choice rather than an open prompt.
    const dimensions = ['character', 'pairing', 'fit', 'compar'];
    const present = dimensions.filter((d) => text.includes(d));
    expect(present.length).toBeGreaterThanOrEqual(2);
  });

  it('does not claim "I don\'t have enough data" — that was the old fallback voice', () => {
    const activeConsultation = singleBrandConsultation(
      'harbeth',
      'Tell me about Harbeth',
    );
    const resp = buildConsultationFollowUp(activeConsultation, 'hmm', null);
    expect(resp).not.toBeNull();
    const text = joinAdvisoryText(resp!).toLowerCase();
    expect(text).not.toMatch(/don'?t have (?:enough|specific) data/);
  });
});

// ── Specific-kind branches still route correctly ──────────

describe('QA C1 — specific follow-up kinds are unaffected by the fix', () => {
  it('pairing follow-up still routes to the pairing template (mentions pairing semantics)', () => {
    const activeConsultation = singleBrandConsultation(
      'harbeth',
      'Tell me about Harbeth',
    );
    const resp = buildConsultationFollowUp(
      activeConsultation,
      'what pairs well with it?',
      null,
    );
    expect(resp).not.toBeNull();
    const text = joinAdvisoryText(resp!).toLowerCase();
    // Pairing template should mention pair / match / amp territory —
    // not the general "which would be most useful" closer.
    expect(text).toMatch(/pair|amplif|match|complement/);
  });

  it('sonic-detail follow-up still routes to the sonic_detail template', () => {
    const activeConsultation = singleBrandConsultation(
      'devore',
      'Tell me about DeVore',
    );
    const resp = buildConsultationFollowUp(
      activeConsultation,
      'how is the bass?',
      null,
    );
    expect(resp).not.toBeNull();
    // The general-fallback closer asks the four-dimension question.
    // Sonic-detail should not — it has its own closer ("What are you
    // pairing this with?").
    const followUp = (resp!.followUp ?? '').toLowerCase();
    expect(followUp).not.toMatch(/character.*pairing.*fit/);
  });
});
