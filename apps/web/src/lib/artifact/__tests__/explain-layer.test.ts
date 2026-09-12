/**
 * Explain layer — system synergy pins (2026-09-11).
 *
 * The production Boenicke assessment led with "Tonally balanced,
 * detail-forward, elastically flowing, spatially open system emphasizing
 * transient clarity." while its own licensed verdict said "No system-level
 * interaction is established on the evidence held" — Describe-lane catalog
 * priors, averaged into adjectives, jumping straight to Evaluate. Meanwhile
 * the system relationships the engine actually computes (conversion path,
 * the figures that block the amplifier↔loudspeaker interface) never reached
 * the review as system reasoning.
 *
 * These pins protect the repair:
 *
 *   - the canonical path passes NO tonal signature into the review; only a
 *     constraint-category standfirst (an engine-worded, figure-derived
 *     judgment) may lead THE ASSESSMENT;
 *   - HOW THIS SYSTEM FITS TOGETHER states, from licensed computation only,
 *     which relationship defines the system, what state it is in, why
 *     unsettled topology matters, and which missing fact blocks which
 *     decision;
 *   - no sonic system character is composed anywhere in that section;
 *   - a sparse system still gets a useful structural assessment.
 */
import { describe, it, expect } from 'vitest';
import { composeSystemReviewDetailed } from '../system-review';
import { synthesiseChain } from '../sonic-synthesis';
import type { DossierView } from '@/lib/evidence/dossier-presentation';
import { buildTurnContext } from '@/lib/turn-context';
import { buildSystemAssessment } from '@/lib/consultation';
import { authoritativeAssessment } from '@/lib/assessment/from-result';

const dossier = (displayName: string, lines: Array<[string, string]>): DossierView => ({
  displayName, role: '', secondary: [], gaps: [],
  primary: lines.map(([label, value]) => ({
    label, value, provenance: 'maker_published', source: 'maker',
  })),
} as unknown as DossierView);

const FRANCE = [
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

const SONIC_FABRICATION = /tonally|detail-forward|elastically|spatially open|transient clarity|airy|warm,|bright,/i;

function fitsOf(d: ReturnType<typeof composeSystemReviewDetailed>): string {
  return (d.sections ?? []).find((s) => /fits together/i.test(s.label))
    ?.paragraphs.join('\n') ?? '';
}

describe('1 — unresolved defining relationship, stated as the decision it blocks', () => {
  const d = composeSystemReviewDetailed({
    components: [
      { displayName: 'Topping D70 Pro OCTO', role: 'dac' },
      { displayName: 'Nad AV716', role: 'integrated' },
      { displayName: 'Dynaco A35', role: 'speaker' },
    ],
    dossiers: [],
    rawQuery: 'assess my system: NAD AV716 receiver, Topping D70 Pro OCTO DAC, Dynaco A35 speakers',
  });
  const fits = fitsOf(d);

  it('names the amplifier→loudspeaker relationship as the one to examine first', () => {
    expect(fits).toMatch(/first relationship I would examine/);
    expect(fits).toMatch(/Nad AV716 driving the Dynaco A35/);
  });

  it('frames the uncertainty as the decision it prevents, naming the missing figures', () => {
    expect(fits).toMatch(/not enough to say whether it is actually limiting/);
    expect(fits).toMatch(/stays an open question/);
    expect(fits).toMatch(/rated output/);
    expect(fits).toMatch(/sensitivity/);
  });

  it('composes no sonic system character', () => {
    expect(fits).not.toMatch(SONIC_FABRICATION);
    expect(d.paragraphs.join('\n')).not.toMatch(/tonally balanced|detail-forward/i);
  });
});

describe('2 — unsettled topology explained, not just asked', () => {
  const d = composeSystemReviewDetailed({
    components: FRANCE,
    dossiers: FRANCE_DOSSIERS,
    synthesis: synthesiseChain(FRANCE),
    rawQuery: 'Assess my system: JOB INTegrated, WLM Diva Monitor, Eversolo DMP-A6, Chord Hugo',
  });
  const fits = fitsOf(d);

  it('says WHY the conversion path matters before the ask', () => {
    expect(fits).toMatch(/shape of this system is not yet settled/i);
    expect(fits).toMatch(/decides where the system’s character originates/);
    expect(fits).toMatch(/materially different system/);
    // The ask itself still lives under WHAT I WOULD DO.
    expect(d.paragraphs.join('\n')).toMatch(/how are you connecting them\?/);
  });

  it('starts its sentences as sentences', () => {
    for (const p of (d.sections ?? []).find((s) => /fits together/i.test(s.label))?.paragraphs ?? []) {
      expect(p.charAt(0)).toMatch(/[A-Z]/);
    }
  });
});

describe('3 — stated topology is honoured', () => {
  const d = composeSystemReviewDetailed({
    components: FRANCE,
    dossiers: FRANCE_DOSSIERS,
    synthesis: synthesiseChain(FRANCE),
    rawQuery: 'Eversolo DMP-A6 digital out into the Chord Hugo, Hugo into the JOB analogue input, driving WLM Diva monitors',
  });
  const fits = fitsOf(d);

  it('acknowledges the established path and does not re-ask', () => {
    expect(fits).toMatch(/signal path is established from your description/);
    expect(d.paragraphs.join('\n')).not.toMatch(/how are you connecting them\?/);
  });
});

describe('4 — a standing constraint owns the ground', () => {
  const d = composeSystemReviewDetailed({
    components: [
      { displayName: 'Zorblax ZX1', role: 'amplifier' },
      { displayName: 'Magnepan LRS+', role: 'speaker' },
    ],
    dossiers: [],
    driveFinding: 'On the published figures, this amplifier cannot drive these loudspeakers to satisfying levels.',
    constraintPresent: true,
  });

  it('does not compose a likely-ceiling hypothesis next to an established constraint', () => {
    expect(fitsOf(d)).not.toMatch(/most likely to set/);
  });
});

describe('5 — the Boenicke control, end to end', () => {
  const GUEST = {
    activeSystemRef: { kind: 'none' }, savedSystems: [], draftSystem: null,
    loading: false, proposedSystem: null,
  } as never;
  const M = 'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, Boenicke W5';
  const tc = buildTurnContext(M, GUEST, new Set(), undefined);
  const r = buildSystemAssessment(M, tc.subjectMatches, tc.activeSystem, []) as never as { kind: string };
  const snap = authoritativeAssessment({ ...(r as object), query: M } as never) as never as {
    verdict?: string;
    reviewSections?: Array<{ label: string; paragraphs: string[] }>;
  };

  it('no unlicensed tonal thesis leads the assessment', () => {
    const assessment = snap.reviewSections?.find((s) => /the assessment/i.test(s.label));
    expect(assessment?.paragraphs.join(' ') ?? '').not.toMatch(SONIC_FABRICATION);
  });

  it('the review carries the Explain section with the defining relationship', () => {
    const fits = snap.reviewSections?.find((s) => /fits together/i.test(s.label));
    expect(fits).toBeTruthy();
    expect(fits!.paragraphs.join(' ')).toMatch(/JOB INTegrated driving the Boenicke W5/);
    expect(fits!.paragraphs.join(' ')).toMatch(/not enough to say whether it is actually limiting/);
  });

  it('the licensed verdict stands', () => {
    expect(snap.verdict).toMatch(/I can assess this system’s structure, but not yet how it performs together/);
  }, 30000);

  it('a constraint standfirst still leads a constrained system', () => {
    const M2 = 'Assess my system: Decware SE84UFO, Magnepan LRS+';
    const tc2 = buildTurnContext(M2, GUEST, new Set(), undefined);
    const r2 = buildSystemAssessment(M2, tc2.subjectMatches, tc2.activeSystem, []) as never;
    const snap2 = authoritativeAssessment({ ...(r2 as object), query: M2 } as never) as never as {
      reviewSections?: Array<{ label: string; paragraphs: string[] }>;
    };
    const assessment = snap2.reviewSections?.find((s) => /the assessment/i.test(s.label));
    expect(assessment?.paragraphs[0]).toMatch(/The match is the problem/);
  }, 30000);
});

describe('6 — the model lead is a judgment channel, never a power finding', () => {
  const COMPONENTS = [
    { displayName: 'Amp X', role: 'amplifier' },
    { displayName: 'Speaker Y', role: 'speaker' },
  ];

  it('a guarded model lead opens the assessment when nothing deterministic does', () => {
    const d = composeSystemReviewDetailed({
      components: COMPONENTS, dossiers: [],
      modelLead: 'The system’s performance is indeterminate because its power output and load demands are unresolved.',
    });
    expect(d.paragraphs[0]).toMatch(/^The system’s performance is indeterminate/);
  });

  it('power vocabulary in the model lead licenses neither restraint nor a settled power premise', () => {
    const d = composeSystemReviewDetailed({
      components: COMPONENTS, dossiers: [],
      synthesis: undefined,
      modelLead: 'Power output remains unresolved for this amplifier.',
    });
    const all = d.paragraphs.join('\n');
    expect(all).not.toMatch(/I wouldn't make a change based on amplifier power/);
    expect(all).not.toMatch(/enough to settle the power question/);
  });

  it('a genuine drive finding outranks the model lead', () => {
    const d = composeSystemReviewDetailed({
      components: COMPONENTS, dossiers: [],
      driveFinding: 'On the published figures, amplifier power is unlikely to be the constraint here.',
      modelLead: 'A model judgment that must not displace the deterministic finding.',
    });
    expect(d.paragraphs[0]).toMatch(/amplifier power is unlikely/);
  });
});
