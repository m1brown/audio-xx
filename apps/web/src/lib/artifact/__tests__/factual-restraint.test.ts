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

  it('D-11: a reference DAC is not diagnosed as the system ceiling on its intrinsic character', () => {
    // Doctrine D-11 (Explanatory Licensing) supersedes the former DAC-limitation
    // diagnosis: a respected, neutral DAC like the Chord Qutest has intrinsic
    // character (a lean tonal balance), not a licensed limitation. With no power
    // mismatch or capability mismatch present, it must NOT be diagnosed as
    // holding the system back / setting the ceiling.
    const r = runArtifactPipeline('Assess my system: Chord Qutest, Naim SuperNait 3, Klipsch La Scala');
    expect(r).toBeTruthy();
    expect(r!.payload.verdict).not.toMatch(/DAC is (holding|steering)/i);
    const body = r!.payload.caseParagraphs.join('\n').toLowerCase();
    expect(body).not.toMatch(/holding back the system|source setting the system|inherits its limit/);
  });
});
