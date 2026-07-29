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
  validateDominantCharacter,
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
    expect(cam.identity.tonalSignature?.length).toBe(3);
    expect(cam.identity.tonalSignature?.map((a) => a.axis)).not.toContain('airy_closed');
    expect(cam.guidance.recommendation).toBeTruthy();
    expect(cam.reading.engineering.length).toBeGreaterThan(0);
    expect(cam.reading.listeningSession.length).toBe(2);
    expect(cam.reading.dominantCharacter).toBeTruthy();
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

  it('Dominant Character is grounded, descriptive, and obeys the invariant', () => {
    const { cam } = franceCanonical();
    expect(cam.reading.dominantCharacter).toBe(
      "Warmth enters at the final stage, without obscuring the system's resolution.",
    );
    expect(validateDominantCharacter(cam.reading.dominantCharacter)).toEqual([]);
  });

  it('degrades gracefully from payload alone (no raw): no tonal signature, still valid', () => {
    const { payload } = franceCanonical();
    const cam = toCanonicalAssessment(payload);
    expect(cam.identity.tonalSignature).toBeUndefined();
    expect(cam.identity.verdict).toBe(payload.verdict);
    expect(cam.evidence.statement).toBe(EVIDENCE_STATEMENT);
  });
});

describe('Educational layer (France) — primary-sourced, identity-preserving', () => {
  it('attaches a primary-sourced origin clause to each France component', () => {
    const { cam } = franceCanonical();
    for (const c of cam.subject.components) {
      expect(c.origin, `${c.name} origin`).toBeTruthy();
      expect(c.source?.url, `${c.name} source`).toMatch(/^https?:\/\//);
    }
    // JOB is minimally sourced: no Goldmund / Swiss claim (not primary-sourced).
    const job = cam.subject.components.find((c) => /job/i.test(c.name))!;
    expect(job.origin!.toLowerCase()).not.toMatch(/goldmund|swiss|switzerland/);
  });

  it('lists primary sources only — no reviewers, retailers, forums, or wikis', () => {
    const { cam } = franceCanonical();
    const urls = (cam.evidence.primarySources ?? []).map((s) => s.url).join(' ');
    expect(cam.evidence.primarySources?.length).toBeGreaterThanOrEqual(3);
    expect(urls).not.toMatch(/reddit|head-fi|audiogon|reverb|stereophile|6moons|whathifi|wikipedia|forum|audiomart/i);
    expect(urls).toMatch(/eversolo\.com|chordelectronics|wiener-lautsprecher|jobsys/);
  });

  it('teaches the reinforce/oppose in Engineering without altering identity', () => {
    const { cam, payload } = franceCanonical();
    expect(cam.reading.engineering.join(' ')).toMatch(/pull in different directions|resolution against ease/i);
    // Immutable identity is untouched by the educational layer.
    expect(cam.identity.verdict).toBe(payload.verdict);
    expect(cam.identity.signature).toBe(payload.standfirst);
    expect(cam.identity.recognition).toBe(payload.recognition);
    expect(cam.reading.dominantCharacter).toBe(
      "Warmth enters at the final stage, without obscuring the system's resolution.",
    );
    // smooth_detailed still commits to Detailed (identity classification unchanged).
    expect(cam.identity.tonalSignature!.find((a) => a.axis === 'smooth_detailed')!.pole).toBe('right');
  });

  it('does not propagate the unverified "passive radiator" catalog claim', () => {
    const { cam } = franceCanonical();
    expect(cam.reading.operatingCondition?.toLowerCase()).not.toContain('passive radiator');
  });
});

describe('validateDominantCharacter', () => {
  it('accepts a grounded, descriptive characteristic', () => {
    expect(validateDominantCharacter("Warmth enters at the final stage, without obscuring the system's resolution.")).toEqual([]);
    expect(validateDominantCharacter('Resolution leads, and the rest of the system keeps it clean.')).toEqual([]);
  });
  it('rejects teleology — unverified designer/listener intent', () => {
    expect(validateDominantCharacter("The only warm voice is the one you're meant to hear.")).toContain('teleology');
    expect(validateDominantCharacter('A tuning intended to flatter vocals.')).toContain('teleology');
    expect(validateDominantCharacter('Designed to disappear into the room.')).toContain('teleology');
  });
  it('rejects causal justification', () => {
    expect(validateDominantCharacter('A detail rig, because the warmth sits at the speaker.')).toContain('justifies');
    expect(validateDominantCharacter('It resolves, therefore it satisfies.')).toContain('justifies');
  });
  it('rejects a second sentence (one characteristic, then stop)', () => {
    expect(validateDominantCharacter('It is detailed. It is also warm.')).toContain('multi-sentence');
  });
  it('rejects empty', () => {
    expect(validateDominantCharacter('')).toContain('empty');
    expect(validateDominantCharacter(undefined)).toContain('empty');
  });
});
