/**
 * Composition coherence — Grok-parity mission pins (2026-09-19).
 *
 * Three repairs and one standing boundary:
 *
 *  1. ONE COHERENT BOUNDED JUDGMENT — when the thesis states a supported
 *     amplifier-power judgment, the relationship section must not reopen
 *     the same question ("stays an open question — the one that most
 *     limits this assessment"). It names what would FIRM the reading.
 *  2. THE CONVERSION AMBIGUITY IS STATED ONCE — the structural finding in
 *     "How this system fits together", the question (naming the stages)
 *     in "What I would do"; never the full statement twice.
 *  3. NO STUB OPENERS — a bare-figures drive line does not open the
 *     assessment when the real judgment paragraph follows.
 *  4. NO GROK-STYLE OVERCLAIMING — the deterministic composer never
 *     emits whole-system verdicts it cannot license: "optimized",
 *     "well matched", fatigue guarantees, preference-fit claims, or
 *     unlicensed keep-it verdicts. (The governed lane may EARN
 *     listener-fit claims from stated observations; this composer
 *     cannot, and must not fake them.)
 */
import { describe, it, expect } from 'vitest';
import { composeSystemReviewDetailed } from '../system-review';
import type { DossierView } from '@/lib/evidence/dossier-presentation';

const dossier = (displayName: string, lines: Array<[string, string]>): DossierView => ({
  displayName, role: '', secondary: [], gaps: [],
  primary: lines.map(([label, value]) => ({
    label, value, provenance: 'maker_published', source: 'maker',
  })),
} as unknown as DossierView);

/** France II as production composes it: reported speaker sensitivity, an
 *  amplifier whose only power figure is the maker's family reference, no
 *  speaker impedance, no amplifier rating of its own. */
const FRANCE_II = [
  { displayName: 'Eversolo DMP-A6', role: 'streamer' },
  { displayName: 'Chord Hugo', role: 'dac' },
  { displayName: 'Job integrated', role: 'amplifier' },
  { displayName: 'WLM Diva monitor', role: 'speaker' },
];
const FRANCE_DOSSIERS = [
  dossier('Eversolo DMP-A6', [['Line output level', '2.6V (RCA)']]),
  dossier('Chord Hugo', [['Architecture', 'portable DAC with analogue output']]),
  dossier('Job integrated', [
    ['Architecture', 'integrated amplifier with onboard D/A conversion and digital inputs'],
    ['Architecture', 'Power-amplifier circuit the maker states is equivalent to the JOB 225, which the maker rates at 125W per channel'],
  ]),
  dossier('WLM Diva monitor', [
    ['Sensitivity — the maker’s claim as a publication reported it', '95dB'],
  ]),
];

const compose = () => composeSystemReviewDetailed({
  components: FRANCE_II,
  dossiers: FRANCE_DOSSIERS,
  rawQuery: 'Assess my system: - JOB INTegrated - WLM Diva Monitor - Eversolo DMP-A6 - Chord Hugo',
});

describe('one coherent bounded power judgment (France II shape)', () => {
  const d = compose();
  const all = d.paragraphs.join('\n');

  it('states the supported power judgment', () => {
    expect(all).toMatch(/amplifier power is very unlikely to be this system.s constraint/);
    expect(all).toMatch(/supported reading rather than an established one/);
  });

  it('never retracts it as an open question three paragraphs later', () => {
    expect(all).not.toMatch(/stays an open question/);
    expect(all).not.toMatch(/the one that most limits this assessment/);
  });

  it('instead names what would firm the reading, at its stated strength', () => {
    expect(all).toMatch(/The relationship to firm up/);
    expect(all).toMatch(/does not reopen it/);
  });
});

describe('control — no standing power judgment keeps the honest open question', () => {
  // Low-sensitivity speaker: the architecture pass cannot judge power, so
  // the relationship section legitimately reports the open question.
  const d = composeSystemReviewDetailed({
    components: FRANCE_II,
    dossiers: [
      FRANCE_DOSSIERS[0], FRANCE_DOSSIERS[1], FRANCE_DOSSIERS[2],
      dossier('WLM Diva monitor', [['Sensitivity — the maker’s claim as a publication reported it', '84dB']]),
    ],
    rawQuery: 'Assess my system: - JOB INTegrated - WLM Diva Monitor - Eversolo DMP-A6 - Chord Hugo',
  });
  const all = d.paragraphs.join('\n');

  it('reports the open question when nothing stronger is licensed', () => {
    expect(all).not.toMatch(/very unlikely to be this system.s constraint/);
    expect(all).toMatch(/stays an open question/);
  });
});

describe('conversion ambiguity is stated once', () => {
  const d = compose();
  const bySection = Object.fromEntries((d.sections ?? []).map((s) => [s.label, s.paragraphs]));

  it('the structural statement appears exactly once, in the fits section', () => {
    const fullStatement = /can each perform digital-to-analogue\s+conversion/;
    const matches = d.paragraphs.filter((p) => fullStatement.test(p));
    expect(matches.length).toBe(1);
    expect((bySection['How this system fits together'] ?? []).some((p) => fullStatement.test(p))).toBe(true);
  });

  it('the question names the stages without the reprise', () => {
    const q = d.paragraphs.find((p) => /how are you connecting them\?/.test(p))!;
    expect(q).toBeTruthy();
    expect(q).toContain('Chord Hugo');
    expect(q).not.toMatch(/can each perform/);
    expect(q).not.toMatch(/not yet settled/);
  });
});

describe('no stub openers', () => {
  const spk = dossier('Harbeth SHL5 plus', [
    ['Sensitivity', '86 dB/2.83 V/1 m axial'],
    ['Impedance', '6 ohms, easy to drive'],
  ]);
  const amp = dossier('Accuphase E-600', [
    ['Power output', '30 W/ch (8 ohms), 60 W/ch (4 ohms), 120 W/ch (2 ohms)'],
  ]);
  const input = {
    components: [
      { displayName: 'Accuphase E-600', role: 'amplifier' },
      { displayName: 'Harbeth SHL5 plus', role: 'speaker' },
    ],
    dossiers: [amp, spk],
    rawQuery: 'Assess my system: Accuphase E-600 and Harbeth SHL5 plus',
  };

  it('a bare-figures drive line does not open the assessment when the judgment follows', () => {
    const d = composeSystemReviewDetailed({
      ...input,
      driveFinding: 'Published figures put the Accuphase E-600 at 30 watts into 8 ohms, while the Harbeth Shl5 plus presents 6 ohms.',
    });
    const bySection = Object.fromEntries((d.sections ?? []).map((s) => [s.label, s.paragraphs]));
    expect(bySection['The assessment'] ?? []).toEqual([]);
    // The figures still reach the reader inside the relationship judgment.
    expect(d.paragraphs.join('\n')).toMatch(/relationship/i);
  });

  it('a drive line that carries a verdict is not a stub and stays', () => {
    const verdictLine = 'Published figures put the pairing on comfortable ground: headroom is adequate at moderate listening levels.';
    const d = composeSystemReviewDetailed({ ...input, driveFinding: verdictLine });
    const bySection = Object.fromEntries((d.sections ?? []).map((s) => [s.label, s.paragraphs]));
    expect(bySection['The assessment']?.[0]).toBe(verdictLine);
  });
});

describe('no Grok-style overclaiming from the deterministic composer', () => {
  // Every fixture this file composes, plus the verdict-carrying variant.
  const outputs = [
    compose().paragraphs.join('\n'),
  ];

  const BANNED = [
    /\boptimi[sz]ed\b/i,
    /\bwell[- ]matched\b/i,
    /\bperfectly\b/i,
    /\bno (?:listening )?fatigue\b/i,
    /\bnon-fatiguing\b/i,
    /\bfatigue-free\b/i,
    /\bwon.t fatigue\b/i,
    /\bbalanced and linear\b/i,
    // Listener-fit verdicts need listener evidence this composer never has.
    /\bsuits? your (?:preferences|taste)\b/i,
    /\baligned with your preferences\b/i,
    /\bexactly what you value\b/i,
    // Unlicensed keep-it verdicts (the scoped, licensed form — "I wouldn't
    // make a change based on <named licence>" — remains allowed).
    /\bkeep (?:it|the system) as it is\b/i,
    /\bnothing needs changing\b/i,
    /\bno upgrade (?:is )?(?:needed|necessary)\b/i,
    /\blong-term keeper\b/i,
  ];

  it('composed prose contains none of the banned verdict vocabulary', () => {
    for (const out of outputs) {
      for (const re of BANNED) {
        expect(out, `banned: ${re}`).not.toMatch(re);
      }
    }
  });

  it('the scoped licensed restraint form is still permitted', () => {
    // The scoped verdict fires when a drive finding names its licence
    // (editorial-hierarchy.test.ts pins the exact wording); here we prove
    // the banned-list does not catch the licensed form.
    const d = composeSystemReviewDetailed({
      components: FRANCE_II,
      dossiers: FRANCE_DOSSIERS,
      rawQuery: 'Assess my system: - JOB INTegrated - WLM Diva Monitor - Eversolo DMP-A6 - Chord Hugo',
      driveFinding: 'A loudspeaker reported at 95dB sensitivity asks very little of amplification whose circuit the maker ties to the JOB 225, a 125W design, so on every figure available, amplifier power is very unlikely to be this system’s constraint.',
    });
    const all = d.paragraphs.join('\n');
    expect(all).toMatch(/I wouldn't make a change based on/);
    for (const re of BANNED) expect(all, `banned: ${re}`).not.toMatch(re);
  });
});
