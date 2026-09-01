/**
 * Beta polish fixes (walkthrough) — regression coverage for the bounded fixes:
 *  - photo rail: never render a lopsided single-image strip (>=2 resolved).
 *  - trade sentence: placement-sensitivity join uses a colon, not a mid-sentence
 *    em-dash + capital ("… sensitivity — Compact …").
 */
import { describe, it, expect } from 'vitest';
import { runArtifactPipeline } from '../../../product/assessment-pipeline';

const CASES = [
  'Assess my system: Chord Qutest, Naim Nait XS 3, Harbeth P3ESR',
  'Assess my system: Eversolo DMP-A6, Chord Hugo, Job integrated, WLM Diva monitor',
];

describe('Beta polish — photo rail', () => {
  it('componentPhotos is either omitted or has >=2 resolved images (never lopsided single)', () => {
    for (const t of CASES) {
      const r = runArtifactPipeline(t);
      const photos = r?.payload.componentPhotos;
      if (photos !== undefined) {
        expect(photos.filter(Boolean).length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('Beta polish — trade sentence join', () => {
  it('placement-sensitivity trade uses a colon, not "sensitivity — Capital"', () => {
    const r = runArtifactPipeline('Assess my system: Chord Qutest, Naim Nait XS 3, Harbeth P3ESR');
    const text = (r?.payload.caseParagraphs ?? []).join('\n');
    if (/placement sensitivity/i.test(text)) {
      expect(text).toMatch(/placement sensitivity:/i);
      expect(text).not.toMatch(/placement sensitivity\s+—/i);
    }
  });
});
