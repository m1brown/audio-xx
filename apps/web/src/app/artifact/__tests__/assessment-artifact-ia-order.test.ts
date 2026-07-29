/**
 * Assessment Renderer — canonical order + identity consistency + evidence
 * discipline. Renders the France reference CAM through the shared component and
 * pins:
 *   subject → verdict → recognition → recommendation → (divider)
 *   → engineering → listening session → one true thing → operating condition
 *   → single evidence statement
 * The verdict leads the reading; identity text matches the CAM (no re-derivation);
 * the detailed source ledger is never rendered; the One True Thing obeys its rule.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AssessmentArtifact from '../AssessmentArtifact';
import { extractSubjectMatches, detectIntent } from '@/lib/intent';
import { buildSystemAssessment } from '@/lib/consultation';
import { synthesizeArtifact } from '@/lib/artifact/synthesizeArtifact';
import { toCanonicalAssessment, validateDominantCharacter, EVIDENCE_STATEMENT } from '@/lib/artifact/canonical';

const FRANCE = 'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, WLM Diva Monitor';

function franceCam() {
  const subs = extractSubjectMatches(FRANCE);
  const { desires } = detectIntent(FRANCE);
  const raw: any = buildSystemAssessment(FRANCE, subs, null, desires);
  const { payload } = synthesizeArtifact(raw) as any;
  return toCanonicalAssessment(payload, raw);
}

function render(canonical: ReturnType<typeof franceCam>): string {
  return renderToStaticMarkup(createElement(AssessmentArtifact, { canonical, print: true }));
}

/** Match React's HTML text escaping so string lookups find rendered content. */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

describe('Assessment Renderer — France web artifact', () => {
  it('renders every mandatory section in canonical order, verdict leading', () => {
    const cam = franceCam();
    const html = render(cam);

    const iSystem = html.indexOf(cam.subject.components[0].name);
    const iVerdict = html.indexOf(cam.identity.verdict);
    const iRecognition = html.indexOf(cam.identity.recognition.slice(0, 24));
    const iRecommend = html.indexOf(cam.guidance.recommendation);
    const iEng = html.indexOf(cam.reading.engineering[0].slice(0, 24));
    const iListen = html.indexOf(cam.reading.listeningSession[0].slice(0, 24));
    const iOtt = html.indexOf(esc(cam.reading.dominantCharacter!));
    const iCond = html.indexOf(cam.reading.operatingCondition!.slice(0, 24));
    const iEvidence = html.indexOf(EVIDENCE_STATEMENT);

    for (const idx of [iSystem, iVerdict, iRecognition, iRecommend, iEng, iListen, iOtt, iCond, iEvidence]) {
      expect(idx).toBeGreaterThan(-1);
    }
    // Verdict leads the reading (after the subject it concerns).
    expect(iSystem).toBeLessThan(iVerdict);
    // Answer before evidence; canonical order through the case.
    expect(iVerdict).toBeLessThan(iRecognition);
    expect(iRecognition).toBeLessThan(iRecommend);
    expect(iRecommend).toBeLessThan(iEng);
    expect(iEng).toBeLessThan(iListen);
    expect(iListen).toBeLessThan(iOtt);
    expect(iOtt).toBeLessThan(iCond);
    expect(iCond).toBeLessThan(iEvidence);
  });

  it('identity text matches the CAM verbatim (no re-derivation in the renderer)', () => {
    const cam = franceCam();
    const html = render(cam);
    expect(html).toContain(cam.identity.verdict);
    expect(html).toContain(cam.identity.signature!);
    expect(html).toContain(cam.identity.recognition);
  });

  it('shows the single evidence statement and never the detailed ledger', () => {
    const html = render(franceCam());
    expect(html).toContain(EVIDENCE_STATEMENT);
    expect(html.toLowerCase()).not.toContain('source ledger');
    expect(html).not.toContain('axx-cls'); // no evidence-class chips
    // The internal editorial provenance ledger must never reach the public artifact.
    expect(html).not.toContain('audio-xx-interpretation');
    expect(html).not.toContain('editorialClass');
    expect(html).not.toContain('manufacturer-fact');
  });

  it('renders the Dominant Character section (not "One True Thing"), obeying the invariant', () => {
    const cam = franceCam();
    const html = render(cam);
    expect(validateDominantCharacter(cam.reading.dominantCharacter)).toEqual([]);
    expect(html).toContain(esc(cam.reading.dominantCharacter!));
    expect(html).toContain('Dominant character');
    expect(html.toLowerCase()).not.toContain('one true thing');
    // no teleology in the rendered line
    expect(html.toLowerCase()).not.toMatch(/meant to|intended to/);
  });
});
