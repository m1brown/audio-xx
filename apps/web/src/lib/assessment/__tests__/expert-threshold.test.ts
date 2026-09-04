/**
 * Expert-system threshold pins (2026-09-04) — mission tests 6–13, 15–19.
 *
 * The regression case throughout is France II with the topology established:
 *
 *   Eversolo DMP-A6 (digital out) → Chord Hugo → JOB INTegrated → WLM Diva
 *
 * Once the path is known, capability ≠ role: the DMP-A6 is streaming
 * infrastructure, the Hugo converts, the JOB amplifies with its own DAC
 * idle, and the Diva dominates what is audible. Gaps weigh by causal
 * importance; verdicts survive immaterial gaps; inference stays labelled
 * inference; the graph derives from the ACTIVE system or does not render.
 */
import { describe, it, expect } from 'vitest';
import type { DossierView } from '@/lib/evidence/dossier-presentation';
import { deriveActiveRoles, interfaceMateriality, demoteBypassedEvidence } from '../active-roles';
import { deriveSystemThesis, composeVerdictLead } from '../system-thesis';
import { governedTonalSignature } from '../governed-signature';
import { composeUnresolved, licenseAssessment } from '../authoritative';
import { composeSystemReviewDetailed } from '../../artifact/system-review';
import { buildConsultationResponse } from '../../consultation';

const dossier = (displayName: string, lines: Array<[string, string]>): DossierView => ({
  displayName,
  role: '',
  primary: lines.map(([label, value]) => ({
    label, value, provenance: 'maker_published', source: 'maker',
  })),
  secondary: [],
  gaps: [],
} as unknown as DossierView);

const FRANCE_II = [
  { displayName: 'Eversolo DMP-A6', role: 'streamer' },
  { displayName: 'Chord Hugo', role: 'dac' },
  { displayName: 'Job integrated', role: 'amplifier' },
  { displayName: 'WLM Diva monitor', role: 'speaker' },
];
const EXPLICIT_PATH =
  'Eversolo DMP-A6 digital out into the Chord Hugo, Hugo into the JOB analogue input, driving WLM Diva monitors';
const DOSSIERS = [
  dossier('Eversolo DMP-A6', [
    ['Line output level', '2.6V (RCA); 5.2V (XLR)'],
    ['Architecture', 'streamer with onboard DAC and analogue output'],
  ]),
  dossier('Chord Hugo', [['Architecture', 'portable DAC with analogue output stage']]),
  dossier('Job integrated', [
    ['Architecture', 'integrated amplifier with onboard D/A conversion and digital inputs'],
    ['Power output', '125W per channel (maker-stated JOB 225 reference)'],
  ]),
  dossier('WLM Diva monitor', [['Sensitivity', '95dB']]),
];

const MODEL = deriveActiveRoles(FRANCE_II, DOSSIERS, EXPLICIT_PATH);

describe('6 — with A6 → Hugo → JOB established, the DMP-A6 is a transport', () => {
  it('assigns transport role with conversion and analogue stages bypassed', () => {
    const a6 = MODEL.roles.find((r) => r.name === 'Eversolo DMP-A6')!;
    expect(a6.activeFunction).toBe('digital_transport');
    expect(a6.bypassed).toContain('dac');
    expect(a6.bypassed).toContain('analogue_output');
    expect(a6.leverage).toBe('low');
  });

  it('the Hugo is the active DAC and the JOB an amplifier with its own DAC idle', () => {
    expect(MODEL.roles.find((r) => r.name === 'Chord Hugo')?.activeFunction).toBe('dac');
    const job = MODEL.roles.find((r) => r.name === 'Job integrated')!;
    expect(job.activeFunction).toBe('amplification');
    expect(job.bypassed).toContain('onboard_dac');
    expect(MODEL.roles.find((r) => r.name === 'WLM Diva monitor')?.leverage).toBe('very_high');
  });

  it('under ambiguity (no stated path, no clear reading) nothing is called bypassed', () => {
    const ambiguous = deriveActiveRoles(FRANCE_II, DOSSIERS,
      'Assess my system: JOB INTegrated, WLM Diva Monitor, Eversolo DMP-A6, Chord Hugo');
    expect(ambiguous.topology).toBe('ambiguous');
    for (const r of ambiguous.roles) {
      if (r.activeFunction === 'undetermined') expect(r.bypassed).toEqual([]);
    }
  });
});

describe('7 — bypassed DMP-A6 evidence does not dominate the assessment', () => {
  it('demotes analogue-stage lines off a transport-only component card', () => {
    const [a6] = demoteBypassedEvidence(
      DOSSIERS.filter((d) => d.displayName === 'Eversolo DMP-A6'), MODEL);
    expect(a6.primary.some((l) => /line output/i.test(l.label))).toBe(false);
    expect(a6.secondary.some((l) => /line output/i.test(l.label))).toBe(true);
  });

  it('never deletes the evidence — provenance survives demotion', () => {
    const [a6] = demoteBypassedEvidence(
      DOSSIERS.filter((d) => d.displayName === 'Eversolo DMP-A6'), MODEL);
    const all = [...a6.primary, ...a6.secondary];
    expect(all.length).toBe(2);
  });
});

describe('8 — functional role governs relevance weighting', () => {
  it('the amplifier/loudspeaker interface is first-order; transport interfaces are low', () => {
    expect(interfaceMateriality(MODEL, 'Job integrated', 'WLM Diva monitor')).toBe('first_order');
    expect(interfaceMateriality(MODEL, 'Eversolo DMP-A6', 'Chord Hugo')).toBe('low');
  });
});

describe('9 — governed inference supports a conclusion without becoming fact', () => {
  it('a drive finding alone licenses a promising verdict, classed as inference', () => {
    const thesis = deriveSystemThesis({
      components: FRANCE_II,
      dossiers: DOSSIERS,
      model: MODEL,
      conclusions: [],
      driveFinding: 'On every figure available, amplifier power is very unlikely to be this system’s constraint.',
    });
    expect(thesis.overall?.judgment).toBe('promising');
    expect(thesis.overall?.basis).toBe('governed_inference');
    const lead = composeVerdictLead(thesis)!;
    expect(lead).toMatch(/^Promising match — moderate confidence\./);
    expect(lead).toMatch(/not an established fact/);
  });

  it('with nothing licensed at all there is no verdict lead — never manufactured', () => {
    const thesis = deriveSystemThesis({
      components: FRANCE_II, dossiers: [], model: MODEL, conclusions: [],
    });
    expect(thesis.overall).toBeUndefined();
    expect(composeVerdictLead(thesis)).toBeUndefined();
  });
});

describe('10 — evidence gaps are weighted by causal importance, not counted', () => {
  it('composeUnresolved files low-leverage interface gaps as not bearing on the assessment', () => {
    const text = composeUnresolved([
      {
        from: 'Eversolo DMP-A6', to: 'Chord Hugo',
        question: 'q', state: 'unresolved', cause: 'missing_product_evidence',
        detail: 'Eversolo DMP-A6 output impedance and Chord Hugo input impedance not held',
      },
      {
        from: 'Job integrated', to: 'WLM Diva monitor',
        question: 'q', state: 'unresolved', cause: 'missing_product_evidence',
        detail: 'Job integrated power output not held',
      },
    ], false, MODEL)!;
    expect(text).toMatch(/Job integrated to WLM Diva monitor/);
    expect(text).toMatch(/do not bear on this assessment/);
    // The transport-side gap appears ONLY inside the low-leverage clause.
    const beforeLowClause = text.split('Unresolved figures at low-leverage')[0];
    expect(beforeLowClause).not.toMatch(/Eversolo DMP-A6 to Chord Hugo/);
  });
});

describe('11 + 15 — weak local evidence does not suppress the verdict; the artifact answers first', () => {
  const detail = composeSystemReviewDetailed({
    components: FRANCE_II,
    dossiers: DOSSIERS,
    rawQuery: EXPLICIT_PATH,
    driveFinding: 'On every figure available, amplifier power is very unlikely to be this system’s constraint.',
  });

  it('leads with a categorical judgment, not an evidence-gap report', () => {
    expect(detail.paragraphs[0]).toMatch(/^(Excellent|Strong|Promising|Mixed) match — /);
  });

  it('names the primary relationship and the transport role in the lead', () => {
    expect(detail.paragraphs[0]).toMatch(/Job integrated into the WLM Diva monitor/);
    expect(detail.paragraphs[0]).toMatch(/streaming infrastructure/);
  });

  it('the thesis records the transport gap as immaterial rather than material', () => {
    expect(detail.thesis?.overall?.judgment).toBe('promising');
    expect(detail.thesis?.upgradePressure).toBe('low');
  });
});

describe('12 + 13 — comparisons retain system context and anchor on the owned model', () => {
  const SYSTEM = {
    components: [
      { displayName: 'WiiM Pro Plus', role: 'streamer' },
      { displayName: 'Yamaha A-S501', role: 'amplifier' },
      { displayName: 'Klipsch RP-600M II', role: 'speaker' },
    ],
  };
  const MATCHES = [
    { name: 'klipsch', kind: 'brand' as const },
    { name: 'wharfedale', kind: 'brand' as const },
  ];
  const QUERY = 'Would Wharfedale Lintons be an upgrade over the Klipschs?';

  it('anchors the brand side on the model actually in the system', () => {
    const res = buildConsultationResponse(QUERY, MATCHES, SYSTEM)!;
    const all = `${res.comparisonSummary ?? ''} ${JSON.stringify(res.comparisonImages ?? [])}`;
    expect(all).toMatch(/RP-600M II/);
    expect(all).not.toMatch(/Heresy IV/);
  });

  it('does not claim ignorance of a system it was just given', () => {
    const res = buildConsultationResponse(QUERY, MATCHES, SYSTEM)!;
    expect(res.comparisonSummary ?? '').not.toMatch(/Without knowing your system/);
  });

  it('CONTROL: without system context the curated representative still stands in, named explicitly', () => {
    const res = buildConsultationResponse(QUERY, MATCHES)!;
    const images = JSON.stringify(res.comparisonImages ?? []);
    expect(images).toMatch(/Heresy IV|Linton/);
  });
});

describe('16–19 — the governed sound-profile graph', () => {
  const AXES = [
    { name: 'Chord Hugo', axes: { warm_bright: 'neutral', smooth_detailed: 'detailed', elastic_controlled: 'controlled', airy_closed: 'neutral' } },
    { name: 'Job integrated', axes: { warm_bright: 'neutral', smooth_detailed: 'detailed', elastic_controlled: 'controlled', airy_closed: 'neutral' } },
    { name: 'WLM Diva monitor', axes: { warm_bright: 'warm', smooth_detailed: 'neutral', elastic_controlled: 'elastic', airy_closed: 'airy' } },
    { name: 'Eversolo DMP-A6', axes: { warm_bright: 'warm', smooth_detailed: 'smooth', elastic_controlled: 'elastic', airy_closed: 'neutral' } },
  ] as never[];

  it('16 — the licence gate now derives a signature instead of stripping it', () => {
    const snap = licenseAssessment({
      schema: 'axx.assessment.v1', createdAt: '', engineVersion: '', origin: 'catalog',
      components: FRANCE_II.map((c) => ({ name: c.displayName, role: c.role })),
      systemReview: [], sections: [], evidenceStatement: '',
      tonalSignature: [{ axis: 'warm_bright', left: 'Warm', right: 'Bright', pole: 'left', position: 30 }],
    } as never, {
      components: FRANCE_II.map((c) => ({ name: c.displayName, role: c.role })),
      dossiers: DOSSIERS,
      traitAuthored: true,
      rawQuery: EXPLICIT_PATH,
      perComponentAxes: AXES as never,
    });
    expect(snap.tonalSignature?.length).toBeGreaterThan(0);
    for (const a of snap.tonalSignature ?? []) {
      expect((a as { basis?: string }).basis).toBe('inferred');
    }
  });

  it('17 — leverage weights the graph toward the active high-leverage stages', () => {
    const readings = governedTonalSignature(AXES as never, MODEL)!;
    // Speaker (warm, very_high) outweighs the two detailed/controlled
    // electronics on warm_bright only partially — but the DETAILED lean of
    // amp+dac cannot be cancelled by a low-leverage transport.
    expect(readings.find((r) => r.axis === 'smooth_detailed')?.pole).toBe('right');
  });

  it('18 — a bypassed transport cannot move the profile', () => {
    const withTransport = governedTonalSignature(AXES as never, MODEL)!;
    const withoutTransport = governedTonalSignature(
      (AXES as never[]).filter((a) => (a as { name: string }).name !== 'Eversolo DMP-A6') as never,
      MODEL,
    )!;
    for (const axis of ['warm_bright', 'smooth_detailed', 'elastic_controlled']) {
      const a = withTransport.find((r) => r.axis === axis);
      const b = withoutTransport.find((r) => r.axis === axis);
      if (a && b) expect(Math.abs(a.position - b.position)).toBeLessThanOrEqual(5);
    }
  });

  it('18b — under ambiguity, undetermined conversion stages contribute nothing', () => {
    const ambiguous = deriveActiveRoles(FRANCE_II, DOSSIERS, 'Assess my system: all four, no connections stated');
    const readings = governedTonalSignature(AXES as never, ambiguous);
    // The speaker still qualifies warm_bright; the undetermined stages are
    // silent rather than asserting the unresolved path.
    for (const r of readings ?? []) expect(r.basis).toBe('inferred');
  });

  it('19 — no unsupported precision: coarse positions, absence over fabrication', () => {
    const readings = governedTonalSignature(AXES as never, MODEL)!;
    for (const r of readings) expect(r.position % 5).toBe(0);
    // No evidenced moderate+ contributor on an axis → the axis is absent.
    const none = governedTonalSignature(AXES as never, MODEL, {
      evidencedComponents: new Set(['Eversolo DMP-A6']), // transport only
    });
    expect(none).toBeUndefined();
  });
});
