/**
 * Gate 10 (G10-D1) — factual restraint on the DAC-bottleneck consequence.
 *
 * The DAC-limitation heard-consequence must describe the system mechanism
 * (the source sets the ceiling), never assert a specific tonal character
 * ("glassy") that can be factually wrong for a respected, musical DAC such
 * as the Chord Qutest. Honesty over apparent expertise.
 */
import { describe, it, expect } from 'vitest';
import { runArtifactPipeline } from '../../../product/assessment-pipeline';

describe('DAC-bottleneck prose stays factually restrained (G10-D1)', () => {
  const cases = [
    'Assess my system: Chord Qutest, Naim SuperNait 3, Klipsch La Scala',
    'Assess my system: Chord Qutest, Parasound A21, Magnepan 1.7i',
    'Assess my system: Topping D90SE, Benchmark AHB2, Focal Utopia',
  ];
  for (const t of cases) {
    it(`never asserts a "glassy" character: ${t.slice(20, 45)}…`, () => {
      const r = runArtifactPipeline(t);
      const body = (r?.payload.caseParagraphs || []).join('\n');
      expect(body).not.toMatch(/glassy/i);
    });
  }

  it('a DAC-limited system still names the source-as-ceiling mechanism', () => {
    const r = runArtifactPipeline('Assess my system: Chord Qutest, Naim SuperNait 3, Klipsch La Scala');
    const body = (r?.payload.caseParagraphs || []).join('\n').toLowerCase();
    // it should still explain the mechanism, just without the false character claim
    expect(body).toMatch(/ceiling|holding|inherits|limits/);
  });
});
