/**
 * Gate 5 — editorial naming defect (G5-D1).
 *
 * A manufacturer/model name placed mid-sentence must keep its casing.
 * The decapitalize-for-flow helper was blindly lowercasing the first
 * character, turning "WLM Diva Monitor" into "wLM Diva Monitor" in the
 * trade sentence — an immediate reader-confidence hit. Common words must
 * still decapitalize so fragments read as clauses.
 */
import { describe, it, expect } from 'vitest';
import { runArtifactPipeline } from '../../../product/assessment-pipeline';

describe('proper-name casing in assessment prose (G5-D1)', () => {
  const r = runArtifactPipeline(
    'evaluate my system: Streamer Eversolo DMP-A6, Amplifier JOB Job integrated, Speakers WLM Diva monitor, Dac Chord Hugo',
  );

  it('produces an assessment', () => {
    expect(r).not.toBeNull();
  });

  it('never mangles the WLM acronym mid-sentence', () => {
    const body = (r!.payload.caseParagraphs || []).join('\n');
    expect(body).not.toMatch(/wLM/);
    // the correctly-cased name should appear in the trade sentence
    expect(body).toMatch(/WLM Diva Monitor/);
  });

  it('still decapitalises common words in the trade fragment', () => {
    // Fragments that lead with an ordinary word must read as clauses,
    // e.g. "transient edge…", "if you want…" — not "Transient", "If".
    const body = (r!.payload.caseParagraphs || []).join('\n');
    expect(body).not.toMatch(/gives up on purpose: [A-Z]/);
  });
});
