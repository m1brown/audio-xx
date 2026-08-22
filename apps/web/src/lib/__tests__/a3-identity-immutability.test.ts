/**
 * A3 identity immutability (Envelope A+B).
 *
 * The deterministic system identity is the single source of truth. The A3
 * composition layer must ELABORATE it, never re-derive or contradict it. These
 * tests pin the guarantee on the France reference system (WLM Diva / Chord Hugo
 * / JOB / Eversolo — the system whose Preview prose drifted to "trades extreme
 * detail" under a detail-forward identity):
 *
 *   1. SYNC   — deriveIdentity(raw) matches the rendered artifact payload, so
 *               the anchor the LLM sees is byte-identical to what ships. This is
 *               the structural guarantee against the two paths desyncing.
 *   2. ANCHOR — the A3 context/prompt carry the established identity.
 *   3. GATE   — composed prose that asserts the opposite net character is
 *               rejected (→ deterministic fallback); consistent prose passes;
 *               negated forms are not false-positives.
 */
import { describe, it, expect } from 'vitest';
import { extractSubjectMatches, detectIntent } from '@/lib/intent';
import { buildSystemAssessment } from '@/lib/consultation';
import { synthesizeArtifact } from '@/lib/artifact/synthesizeArtifact';
import {
  deriveIdentity,
  toArtifactCaseContext,
  buildArtifactCasePrompt,
  validateArtifactCase,
  assertsOppositePole,
} from '@/lib/a3-artifact-case';

const FRANCE = 'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, WLM Diva Monitor';

function franceRaw(): any {
  const subs = extractSubjectMatches(FRANCE);
  const { desires } = detectIntent(FRANCE);
  return buildSystemAssessment(FRANCE, subs, null, desires);
}

describe('deriveIdentity is byte-identical to the rendered artifact identity', () => {
  it('verdict / standfirst / recognition all match synthesizeArtifact', () => {
    const raw = franceRaw();
    const id = deriveIdentity(raw);
    const { payload } = synthesizeArtifact(raw) as any;
    expect(id.verdict).toBe(payload.verdict);
    expect(id.standfirst).toBe(payload.standfirst);
    expect(id.recognition).toBe(payload.recognition);
  });
});

describe('France identity is detail-forward and committed', () => {
  it('committed axes name the detailed pole', () => {
    const raw = franceRaw();
    const id = deriveIdentity(raw);
    // committedAxes now derives from `systemAxisNumeric` like every other
    // system-level pole (2026-08-22). This fixture aggregates to +0.64 on
    // smooth_detailed, well outside the balanced band, so the identity is
    // unchanged — it is still detail-forward and still committed.
    expect(id.committedAxes.smooth_detailed).toBe('detailed');
    expect(id.signature.toLowerCase()).toMatch(/detail/);
    // Recognition ranks by MAGNITUDE, so the strongest commitment leads:
    // elasticity (0.86) ahead of resolution (0.64).
    expect(id.recognition.toLowerCase()).toMatch(/rhythmically elastic, with detail well forward/);
    expect(id.recognition).not.toMatch(/built for|asked to/i);
  });

  it('toArtifactCaseContext carries the established identity to the A3 layer', () => {
    const ctx = toArtifactCaseContext(franceRaw())!;
    expect(ctx).not.toBeNull();
    expect(ctx.committedAxes?.smooth_detailed).toBe('detailed');
    expect(ctx.signature?.toLowerCase()).toMatch(/detail/);
    expect(ctx.recognition?.toLowerCase()).toMatch(/detail well forward/);
  });

  it('the prompt presents identity as fixed and forbids contradiction', () => {
    const ctx = toArtifactCaseContext(franceRaw())!;
    const { systemPrompt, userPrompt } = buildArtifactCasePrompt(ctx);
    expect(systemPrompt).toContain('ESTABLISHED SYSTEM IDENTITY');
    expect(systemPrompt).toMatch(/IMMUTABLE/);
    expect(systemPrompt).toMatch(/must not be contradicted|do NOT "trade away detail"|trade away the very quality/i);
    expect(userPrompt).toContain('established_identity');
  });
});

describe('contradiction gate rejects redefinition, accepts elaboration', () => {
  const ctx = toArtifactCaseContext(franceRaw())!;

  it('rejects the exact Preview drift ("trades extreme detail")', () => {
    const drift = [
      'The Eversolo DMP-A6 and Chord Hugo feed the JOB Integrated a clean signal, and the WLM Diva Monitor gives it a warm voice.',
      "Those components supply clarity, allowing the monitor's warmth to shine through without becoming overly dense.",
      'The result is a presentation that trades extreme detail for a generous sense of space, flowing energy, and a natural tone.',
    ].join('\n\n');
    const fails = validateArtifactCase(drift, ctx);
    expect(fails).toContain('identity-contradiction:smooth_detailed:detailed');
  });

  it('accepts an identity-consistent (detail-forward) elaboration', () => {
    const consistent = [
      'The Eversolo DMP-A6 and Chord Hugo hand the JOB Integrated a resolved, transient-clean signal, and the WLM Diva Monitor carries that detail into the room without hardening it.',
      "The system reads forward and precise; the WLM Diva Monitor's warmth rounds the leading edges without blunting resolution, so precision arrives as presence rather than edge.",
      'The deal is that ultimate ease is left to the speaker — the deliberate cost of a front end chosen to resolve first.',
    ].join('\n\n');
    expect(validateArtifactCase(consistent, ctx)).toEqual([]);
  });

  it('does not false-positive on negated forms ("without sacrificing detail")', () => {
    expect(assertsOppositePole('The WLM Diva Monitor adds body without sacrificing detail or resolution.', ctx.committedAxes)).toEqual([]);
    expect(assertsOppositePole('It rounds edges rather than trading away resolution.', ctx.committedAxes)).toEqual([]);
  });

  it('flags an opposite-pole net claim on any committed axis', () => {
    // airy is committed → a "closed-in soundstage" net claim contradicts it.
    expect(assertsOppositePole('The net result is a congested, closed-in soundstage.', ctx.committedAxes))
      .toContain('airy_closed:airy');
  });
});
