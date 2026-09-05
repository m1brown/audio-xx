/**
 * Editorial hierarchy — pre-acquisition pins (2026-09-06).
 *
 * The assessment reads JUDGMENT → WHY → ACTION → MATERIAL UNCERTAINTY →
 * EVIDENCE DETAIL, using only conclusions production already licensed:
 *
 *   - the strongest licensed judgment opens THE ASSESSMENT;
 *   - WHAT I WOULD DO opens with the recommendation, and restraint
 *     ("I wouldn't change anything yet") is licensed only by a positive
 *     finding with no standing constraint — never manufactured;
 *   - internal accounting language ("N relationships in this chain cannot
 *     be assessed") never reaches the listener;
 *   - topology ambiguity, clarification, and every qualification behave
 *     exactly as qualified for launch.
 *
 * This is a hierarchy change, not a licence change: nothing here may make
 * a claim the same evidence did not already support.
 */
import { describe, it, expect } from 'vitest';
import { composeSystemReviewDetailed } from '../system-review';
import type { DossierView } from '@/lib/evidence/dossier-presentation';
import { synthesiseChain } from '../sonic-synthesis';

const dossier = (displayName: string, lines: Array<[string, string]>): DossierView => ({
  displayName, role: '', secondary: [], gaps: [],
  primary: lines.map(([label, value]) => ({
    label, value, provenance: 'maker_published', source: 'maker',
  })),
} as unknown as DossierView);

const FRANCE_II = [
  { displayName: 'Eversolo DMP-A6', role: 'streamer' },
  { displayName: 'Chord Hugo', role: 'dac' },
  { displayName: 'Job integrated', role: 'amplifier' },
  { displayName: 'WLM Diva monitor', role: 'speaker' },
];
const FRANCE_DOSSIERS = [
  dossier('Eversolo DMP-A6', [['Line output level', '2.6V (RCA)']]),
  dossier('Chord Hugo', [['Architecture', 'portable DAC with analogue output']]),
  dossier('Job integrated', [['Architecture', 'integrated amplifier with onboard D/A conversion and digital inputs']]),
  dossier('WLM Diva monitor', [['Sensitivity', '95dB']]),
];
const DRIVE = 'A loudspeaker reported at 95dB sensitivity asks very little of amplification '
  + 'whose circuit the maker ties to the JOB 225, a 125W design, so on every figure '
  + 'available, amplifier power is very unlikely to be this system’s constraint.';

describe('1 — France II, ambiguous topology', () => {
  const d = composeSystemReviewDetailed({
    components: FRANCE_II,
    dossiers: FRANCE_DOSSIERS,
    rawQuery: 'Assess my system: - JOB INTegrated - WLM Diva Monitor - Eversolo DMP-A6 - Chord Hugo',
    driveFinding: DRIVE,
  });
  const bySection = Object.fromEntries((d.sections ?? []).map((s) => [s.label, s.paragraphs]));

  it('leads with the supported power judgment', () => {
    expect(d.paragraphs[0]).toBe(DRIVE);
    expect(bySection['The assessment']?.[0]).toBe(DRIVE);
  });

  it('WHAT I WOULD DO opens with the restrained recommendation', () => {
    expect(bySection['What I would do']?.[0]).toMatch(/^I wouldn't change anything yet\./);
    expect(bySection['What I would do']?.[0]).toMatch(/establishing how the signal/);
  });

  it('still asks the connection question and invents no topology', () => {
    const all = d.paragraphs.join('\n');
    expect(all).toMatch(/how are you connecting them\?/);
    expect(all).not.toMatch(/contains two conversion stages/);
  });

  it('exposes no relationship-count accounting language', () => {
    expect(d.paragraphs.join('\n')).not.toMatch(/relationships in this chain/);
  });
});

describe('2 — France II, topology explicitly supplied', () => {
  const d = composeSystemReviewDetailed({
    components: FRANCE_II,
    dossiers: FRANCE_DOSSIERS,
    rawQuery: 'Eversolo DMP-A6 digital out into the Chord Hugo, Hugo into the JOB analogue input, driving WLM Diva monitors',
    driveFinding: DRIVE,
  });

  it('does not repeat the clarification, keeps judgment and action lead', () => {
    const all = d.paragraphs.join('\n');
    expect(all).not.toMatch(/how are you connecting them\?/);
    expect(d.paragraphs[0]).toBe(DRIVE);
    expect(all).toMatch(/I wouldn't change anything yet\./);
    // With the path established, the lead does not tell the listener to
    // establish it.
    expect(all).not.toMatch(/establishing how the signal/);
  });
});

describe('3 — simple mainstream system stays frictionless', () => {
  const d = composeSystemReviewDetailed({
    components: [
      { displayName: 'WiiM Pro Plus', role: 'streamer' },
      { displayName: 'Yamaha A-S501', role: 'amplifier' },
      { displayName: 'Klipsch RP-600M II', role: 'speaker' },
    ],
    dossiers: [dossier('Klipsch RP-600M II', [['Sensitivity', '94.5dB @ 2.83V / 1m']])],
    rawQuery: 'Assess my system: WiiM Pro Plus, Yamaha A-S501, Klipsch RP-600M II',
    driveFinding: 'On the published figures, amplifier power is unlikely to be the constraint here.',
  });

  it('no conversion interrogation, licensed restraint only', () => {
    const all = d.paragraphs.join('\n');
    expect(all).not.toMatch(/how are you connecting them\?/);
    // Restraint IS licensed here (favourable drive finding, no constraint).
    expect(all).toMatch(/I wouldn't change anything yet\./);
    expect(all).not.toMatch(/establishing how the signal/);
  });
});

describe('4 — sparse evidence manufactures nothing', () => {
  const d = composeSystemReviewDetailed({
    components: [
      { displayName: 'Mystery Streamer', role: 'streamer' },
      { displayName: 'Mystery Amp', role: 'amplifier' },
      { displayName: 'Mystery Speaker', role: 'speaker' },
    ],
    dossiers: [],
    rawQuery: 'Assess my system: Mystery Streamer, Mystery Amp, Mystery Speaker',
  });

  it('no action lead, no verdict, from absence of evidence', () => {
    const all = d.paragraphs.join('\n');
    expect(all).not.toMatch(/I wouldn't change anything yet\./);
    expect((d.sections ?? []).find((s) => s.label === 'The assessment')).toBeUndefined();
  });
});

describe('5 — a supported constraint outranks comfort', () => {
  const d = composeSystemReviewDetailed({
    components: [
      { displayName: 'Zorblax ZX1', role: 'amplifier' },
      { displayName: 'Magnepan LRS+', role: 'speaker' },
    ],
    dossiers: [],
    driveFinding: 'On the published figures, this amplifier cannot drive these loudspeakers to satisfying levels.',
    constraintPresent: true,
  });

  it('never says "I wouldn\'t change anything yet" under a constraint', () => {
    expect(d.paragraphs.join('\n')).not.toMatch(/I wouldn't change anything yet\./);
  });

  it('the constraint judgment still leads the assessment', () => {
    expect(d.paragraphs[0]).toMatch(/cannot drive these loudspeakers/);
  });
});

describe('6 — listening-evidence gaps stated in listener terms', () => {
  const components = [
    { displayName: 'Eversolo DMP-A6', role: 'dac' },
    { displayName: 'Job integrated', role: 'integrated' },
    { displayName: 'WLM Diva monitor', role: 'speaker' },
  ];
  const d = composeSystemReviewDetailed({
    components,
    dossiers: FRANCE_DOSSIERS,
    synthesis: synthesiseChain(components),
    driveFinding: DRIVE,
  });

  it('replaces counting with the sufficiency statement', () => {
    const all = d.paragraphs.join('\n');
    expect(all).not.toMatch(/relationships in this chain/);
    expect(all).not.toMatch(/\d+ of the relationships/);
    if (/no admitted independent listening evidence/.test(all)) {
      expect(all).toMatch(/enough to settle the power question above/);
      expect(all).toMatch(/not enough to establish how this combination sounds/);
    }
  });
});
