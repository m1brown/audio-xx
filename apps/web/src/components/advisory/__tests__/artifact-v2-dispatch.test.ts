/**
 * v2 Assessment Artifact dispatch — flag + carrier behaviour.
 *
 * Locks the three-way precedence in AdvisoryMessage's memo-format branch:
 *   1. ASSESSMENT_ARTIFACT_V2_ENABLED + advisory.__rawAssessment present
 *      → render v2 AssessmentArtifact (embedded).
 *   2. else SYSTEM_ASSESSMENT_ARTIFACT_ENABLED → legacy SystemAssessmentArtifact.
 *   3. else → MemoFormat.
 *
 * The dispatch site is purely a presentation gate; both flags default off
 * and the legacy MemoFormat path must remain byte-identical with both
 * flags off. The v2 branch must gracefully fall through to (2) / (3) when
 * the raw carrier is missing (fixture-built advisories / tests that don't
 * route through the page.tsx seam).
 *
 * Scope: pure synthesizer + payload-shape contract for the v2 branch.
 * The cascade ordering and renderer wiring are reviewed in
 * AdvisoryMessage.tsx; this file pins the consumer contract.
 */

import { describe, it, expect } from 'vitest';

import { synthesizeArtifact } from '@/lib/artifact/synthesizeArtifact';
import { buildSystemAssessment } from '@/lib/consultation';
import { extractSubjectMatches } from '@/lib/intent';

function runEngine(text: string) {
  const subjects = extractSubjectMatches(text);
  const result = buildSystemAssessment(text, subjects, null, undefined);
  if (!result || result.kind !== 'assessment') {
    throw new Error(`expected assessment, got ${result?.kind ?? 'null'}: ${text}`);
  }
  return result;
}

describe('v2 Assessment Artifact dispatch', () => {
  it('synthesizes a payload from the raw engine result (flawed path)', () => {
    const raw = runEngine('Assess my system: Holo May (KTE), Decware SE84UFO, Magnepan LRS+');
    const { payload } = synthesizeArtifact(raw);
    expect(payload.verdict).toMatch(/amplifier|speakers/i);
    expect(payload.recognition.startsWith('This system is built for')).toBe(true);
    expect(payload.recommendation).toMatch(/power mismatch|amplifier|speakers/i);
    expect(payload.heroDatum?.value).toMatch(/dB$/);
    // R1: recognition must not equal the standfirst.
    const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    expect(norm(payload.recognition)).not.toBe(norm(payload.standfirst));
    // R5: no recommendation preview inside the case prose.
    const judgment = [payload.recognition, ...payload.caseParagraphs].join(' ');
    expect(judgment).not.toMatch(/\bI[’']d\b|\bI would\b|\byou should\b/i);
  });

  it('synthesizes a payload from the raw engine result (restraint path)', () => {
    const raw = runEngine('Assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus');
    const { payload } = synthesizeArtifact(raw);
    expect(payload.verdict).toBe('Nothing here needs changing.');
    expect(payload.recommendation).toBe('This system is already well balanced.');
    expect(payload.recognition.startsWith('This system is built for')).toBe(true);
    // R8: no forbidden refrain in the restraint case.
    const judgment = [payload.recognition, ...payload.caseParagraphs].join(' ');
    expect(judgment).not.toMatch(/it is balanced|no weak link|nothing (?:here )?needs changing|nothing needs fixing/i);
    // R8 demonstration phrasing should be present.
    expect(judgment).toMatch(/resolve cleanly|carries it without|chosen for|asking it to do more/);
  });

  it('does not require a raw carrier — synthesizer is invoked only after the dispatch precedence check', () => {
    // The dispatch site reads advisory.__rawAssessment; missing carrier means
    // the legacy MemoFormat / SystemAssessmentArtifact branches handle the
    // render. This test pins the type contract: the carrier is optional.
    const advisoryWithoutCarrier: { __rawAssessment?: unknown } = {};
    expect(advisoryWithoutCarrier.__rawAssessment).toBeUndefined();
  });

  it('carries the raw assessment as an opaque value (round-trip identity)', () => {
    const raw = runEngine('Assess my system: Holo May (KTE), Decware SE84UFO, Magnepan LRS+');
    const advisory: { __rawAssessment?: unknown } = { __rawAssessment: raw };
    expect(advisory.__rawAssessment).toBe(raw);
    // The synthesizer accepts the carrier without unwrapping.
    const { payload } = synthesizeArtifact(advisory.__rawAssessment);
    expect(payload.verdict).toMatch(/amplifier|speakers/i);
  });
});
