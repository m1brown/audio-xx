/**
 * Relationship-first evidence — D-7/D-8 pins (2026-09-11).
 *
 * Evidence enters because a material system relationship named it, and each
 * tier keeps its licence:
 *
 *   - maker facts remain facts: the W5's sensitivity and nominal impedance
 *     license the loudspeaker's side of the drive question — never a claim
 *     about sound;
 *   - family evidence stays conditional and non-calculable: the JOB 225's
 *     maker figures are recorded as context for the circuit the maker
 *     states the INTegrated shares, and can never enter drive arithmetic;
 *   - every dossier surface reads ONE authored record — the artifact route
 *     reasoned over less evidence than the conversation until 2026-09-11;
 *   - decision-relevant absences are named as the decision they block
 *     (UnknownField.wouldCloseWith), not as empty database fields.
 */
import { describe, it, expect } from 'vitest';
import { RELATIONSHIP_FACTS, RELATIONSHIP_UNKNOWN_BY_PRODUCT, AUTHORED_FACTS } from '../relationship-facts';
import { buildServerDossiers } from '@/lib/assessment/server-dossiers';
import { composeSystemReviewDetailed } from '@/lib/artifact/system-review';
import { synthesiseChain } from '@/lib/artifact/sonic-synthesis';

const CONTROL = [
  { name: 'Eversolo DMP-A6', role: 'streamer' },
  { name: 'Chord Hugo', role: 'dac' },
  { name: 'JOB Integrated', role: 'amplifier' },
  { name: 'Boenicke W5', role: 'speaker' },
];

describe('1 — the W5 maker facts carry their exact licence', () => {
  const w5 = RELATIONSHIP_FACTS.filter((f) => f.productKey === 'boenicke w5');

  it('sensitivity and nominal impedance are maker-published with quoted provenance', () => {
    const sens = w5.find((f) => f.qualifier === 'sensitivity');
    const imp = w5.find((f) => f.qualifier === 'nominal impedance');
    for (const f of [sens, imp]) {
      expect(f).toBeTruthy();
      expect(f!.sourceClass).toBe('maker_published');
      expect(f!.sourceUrl).toMatch(/boenicke-audio\.ch/);
      expect(f!.quotedText).toBeTruthy();
    }
  });

  it('no W5 fact is a listening claim', () => {
    for (const f of w5) {
      expect(f.value).not.toMatch(/sounds?|warm|bright|holographic|imaging|musical/i);
    }
  });

  it('the revision state is stated, not silently absorbed', () => {
    expect(w5.some((f) => /MK2 designation/.test(f.value))).toBe(true);
  });
});

describe('2 — family evidence stays conditional and non-calculable', () => {
  it('the JOB 225 technical figures can never enter drive arithmetic', () => {
    const jobFacts = AUTHORED_FACTS.filter((f) => f.productKey === 'job integrated');
    expect(jobFacts.length).toBeGreaterThan(0);
    for (const f of jobFacts) {
      expect(f.specRole).not.toBe('amplifier_output');
    }
  });

  it('every family figure names its exact reference model conditionally', () => {
    const fam = RELATIONSHIP_FACTS.filter(
      (f) => f.productKey === 'job integrated' && /125W/.test(f.value));
    expect(fam.length).toBeGreaterThan(0);
    for (const f of fam) {
      expect(f.value).toMatch(/JOB 225/);
      expect(f.value).toMatch(/the maker states the INTegrated shares/);
    }
  });
});

describe('3 — one authored record on every surface', () => {
  it('the server/artifact dossiers carry the authored facts', async () => {
    const ds = await buildServerDossiers(CONTROL);
    const lines = (name: string) => {
      const d = ds.find((x) => x.displayName === name);
      return [...(d?.primary ?? []), ...(d?.secondary ?? [])]
        .map((l) => `${l.label}: ${l.value}`).join('\n');
    };
    // The W5's decisive figures, under the exact labels the composer reads.
    expect(lines('Boenicke W5')).toMatch(/sensitivity: 83–86dB/);
    expect(lines('Boenicke W5')).toMatch(/nominal impedance: 4 ohms/);
    // The JOB conversion-topology fact — invisible on this surface before.
    expect(lines('JOB Integrated')).toMatch(/onboard D\/A conversion/);
    expect(lines('JOB Integrated')).toMatch(/125W/);
  }, 30000);

  it('decision-relevant absences reach the artifact dossiers as typed gaps', async () => {
    const ds = await buildServerDossiers([
      { name: 'Topping D70 Pro OCTO', role: 'dac' },
      { name: 'Nad AV716', role: 'integrated' },
      { name: 'Dynaco A35', role: 'speaker' },
    ]);
    const gaps = ds.flatMap((d) => (d.typedGaps ?? []).map((g) => g.quantity));
    expect(gaps).toContain('amplifier_rated_output');
    expect(gaps).toContain('speaker_load_profile');
  }, 30000);
});

describe('4 — stronger evidence strengthens Explain without a licence leap', () => {
  it('the control narrows to the one remaining figure, with no sonic claim', async () => {
    const ds = await buildServerDossiers(CONTROL);
    const rc = ds.map((d) => ({ displayName: d.displayName, role: d.role ?? '' }));
    const det = composeSystemReviewDetailed({
      components: rc, dossiers: ds, synthesis: synthesiseChain(rc),
      rawQuery: 'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, Boenicke W5',
    });
    const fits = (det.sections ?? []).find((s) => /fits together/i.test(s.label))
      ?.paragraphs.join('\n') ?? '';
    const all = det.paragraphs.join('\n');

    // The loudspeaker's side of the drive question is on the record…
    expect(fits).toMatch(/side of that question is on the record/);
    expect(fits).toMatch(/83–86dB/);
    expect(fits).toMatch(/4-ohm nominal load/);
    // …the remaining unknown is the INTegrated's own rating…
    expect(fits).toMatch(/the JOB INTegrated’s rated output/);
    // …the topology question now reaches this surface too…
    expect(fits).toMatch(/shape of this system is not yet settled/);
    // …and no system sound is asserted from any of it.
    expect(fits).not.toMatch(/tonally|warm|bright|airy|spatially open|detail-forward/i);
    expect(all).toMatch(/no admitted independent listening evidence for .* Boenicke W5/);
  }, 30000);
});

describe('5 — evidence needs stay decision-framed', () => {
  it('every UnknownField names what would close it', () => {
    for (const fields of Object.values(RELATIONSHIP_UNKNOWN_BY_PRODUCT)) {
      for (const u of fields) {
        expect(u.decisionRelevant).toBe(true);
        expect((u.wouldCloseWith ?? '').length).toBeGreaterThan(20);
        expect(u.quantity).toBeTruthy();
      }
    }
  });
});
