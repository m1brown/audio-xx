/**
 * IA reorder (GTM pre-beta) — the assessment reads as one self-contained
 * answer above the evidence layer.
 *
 * Pins the information-architecture contract for AssessmentArtifact:
 *   verdict → system(credit/photos) → RECOMMENDATION → cost
 *   → structural divider → Evidence (recognition + case paragraphs)
 *
 * i.e. the recommendation + cost are pulled up beneath the system summary,
 * a divider separates them from the "why" layer, and all copy is preserved.
 * Order/placement only — no copy changes, no restyle.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AssessmentArtifact from '../AssessmentArtifact';

const payload = {
  verdict: 'Nothing here needs changing.',
  standfirst: 'Tonally balanced, detail-forward system.',
  componentCredit: ['Eversolo DMP-A6', 'Chord Hugo', 'Job Integrated', 'WLM Diva Monitor'],
  recognition: 'RECOGNITION_MARK — this system is built for resolution and detail.',
  caseParagraphs: ['CASE_ONE — the components reinforce one another.', 'CASE_TWO — the trade it makes.'],
  recommendation: 'This system is already well balanced.',
  cost: 'If you want more of something, name the quality you are looking for.',
  date: '28 July 2026',
};

// `embedded` = the beta chat surface. `print` = the standalone/print path
// (both skip the FollowUp island, which needs the app-router mounted). The
// reordered DOM is identical across all three renders.
function render(opts: { embedded?: boolean; print?: boolean }): string {
  return renderToStaticMarkup(createElement(AssessmentArtifact, { p: payload as never, ...opts }));
}

describe('AssessmentArtifact IA order — recommendation sits with the verdict, above the evidence', () => {
  for (const mode of [{ embedded: true }, { print: true }] as const) {
    it(`${'embedded' in mode ? 'embedded (chat)' : 'standalone/print'}: verdict → recommendation → cost → divider → evidence`, () => {
      const html = render(mode);
      const iVerdict = html.indexOf(payload.verdict);
      const iRec = html.indexOf(payload.recommendation);
      const iCost = html.indexOf('name the quality');
      const iDivider = html.indexOf('axx-divider');
      const iCase = html.indexOf('axx-case');
      const iRecognition = html.indexOf('RECOGNITION_MARK');
      const iCase1 = html.indexOf('CASE_ONE');

      // All present (copy preserved).
      for (const idx of [iVerdict, iRec, iCost, iDivider, iCase, iRecognition, iCase1]) {
        expect(idx).toBeGreaterThan(-1);
      }
      // Verdict still leads.
      expect(iVerdict).toBeLessThan(iRec);
      // Recommendation + cost are the answer block, before the evidence layer.
      expect(iRec).toBeLessThan(iRecognition);
      expect(iRec).toBeLessThan(iCase1);
      expect(iCost).toBeLessThan(iRecognition);
      // Divider separates the answer from the evidence, and precedes the case.
      expect(iCost).toBeLessThan(iDivider);
      expect(iDivider).toBeLessThan(iCase);
      expect(iDivider).toBeLessThan(iRecognition);
    });
  }

  it('preserves every piece of copy verbatim', () => {
    const html = render({ embedded: true });
    expect(html).toContain(payload.verdict);
    expect(html).toContain(payload.standfirst);
    expect(html).toContain(payload.recommendation);
    expect(html).toContain(payload.cost);
    expect(html).toContain('RECOGNITION_MARK');
    expect(html).toContain('CASE_ONE');
    expect(html).toContain('CASE_TWO');
    for (const c of payload.componentCredit) expect(html).toContain(c);
  });
});
