/**
 * Canonical Assessment Model — adapter + One True Thing invariant.
 * Pins: section presence, canonical order, identity consistency with the engine
 * payload, and the OTT rule (observation only — no justification, one sentence).
 */
import { describe, it, expect } from 'vitest';
import { extractSubjectMatches, detectIntent } from '@/lib/intent';
import { buildSystemAssessment } from '@/lib/consultation';
import { synthesizeArtifact } from '@/lib/artifact/synthesizeArtifact';
import {
  toCanonicalAssessment,
  validateOneTrueThing,
  EVIDENCE_STATEMENT,
} from '@/lib/artifact/canonical';

const FRANCE = 'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, WLM Diva Monitor';

function franceCanonical() {
  const subs = extractSubjectMatches(FRANCE);
  const { desires } = detectIntent(FRANCE);
  const raw: any = buildSystemAssessment(FRANCE, subs, null, desires);
  const { payload } = synthesizeArtifact(raw) as any;
  return { cam: toCanonicalAssessment(payload, raw), payload, raw };
}

describe('CAM adapter — France reference', () => {
  it('carries every required section', () => {
    const { cam } = franceCanonical();
    expect(cam.subject.components.length).toBe(4);
    expect(cam.identity.verdict).toBeTruthy();
    expect(cam.identity.recognition).toBeTruthy();
    expect(cam.identity.tonalSignature?.length).toBe(4);
    expect(cam.guidance.recommendation).toBeTruthy();
    expect(cam.reading.engineering.length).toBeGreaterThan(0);
    expect(cam.reading.listeningSession.length).toBe(2);
    expect(cam.reading.oneTrueThing).toBeTruthy();
    expect(cam.reading.operatingCondition).toBeTruthy();
    expect(cam.evidence.statement).toBe(EVIDENCE_STATEMENT);
  });

  it('identity is consistent with the engine payload (no re-derivation)', () => {
    const { cam, payload } = franceCanonical();
    expect(cam.identity.verdict).toBe(payload.verdict);
    expect(cam.identity.signature).toBe(payload.standfirst);
    expect(cam.identity.recognition).toBe(payload.recognition);
    // tonal signature commits to the detailed pole — matches the engine axes
    const sd = cam.identity.tonalSignature!.find((a) => a.axis === 'smooth_detailed')!;
    expect(sd.pole).toBe('right'); // Detailed
  });

  it('operating condition is separated out of the engineering paragraphs', () => {
    const { cam } = franceCanonical();
    expect(cam.reading.operatingCondition!.toLowerCase()).toMatch(/placement|passive radiator/);
    expect(cam.reading.engineering.join(' ').toLowerCase()).not.toMatch(/moderate placement sensitivity/);
  });

  it('One True Thing obeys the invariant (observation, one sentence, no justification)', () => {
    const { cam } = franceCanonical();
    expect(validateOneTrueThing(cam.reading.oneTrueThing)).toEqual([]);
  });

  it('degrades gracefully from payload alone (no raw): no tonal signature, still valid', () => {
    const { payload } = franceCanonical();
    const cam = toCanonicalAssessment(payload);
    expect(cam.identity.tonalSignature).toBeUndefined();
    expect(cam.identity.verdict).toBe(payload.verdict);
    expect(cam.evidence.statement).toBe(EVIDENCE_STATEMENT);
  });
});

describe('validateOneTrueThing', () => {
  it('accepts a pure observation', () => {
    expect(validateOneTrueThing("The only warm voice in this system is the one you're meant to hear.")).toEqual([]);
  });
  it('rejects causal justification', () => {
    expect(validateOneTrueThing('A detail rig, because the warmth is placed at the speaker.')).toContain('justifies');
    expect(validateOneTrueThing('It resolves, therefore it satisfies.')).toContain('justifies');
    expect(validateOneTrueThing("That's why it works.")).toContain('justifies');
  });
  it('rejects a second sentence (it must state one thing and stop)', () => {
    expect(validateOneTrueThing('It is detailed. It is also warm.')).toContain('multi-sentence');
  });
  it('rejects empty', () => {
    expect(validateOneTrueThing('')).toContain('empty');
    expect(validateOneTrueThing(undefined)).toContain('empty');
  });
});
