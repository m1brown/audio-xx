/**
 * Conversion-path authority — P1 regression pins (2026-09-03).
 *
 * The invariant: COMPONENT IDENTITY MUST NOT IMPLY UNSUPPLIED SIGNAL FLOW.
 *
 * France II exposed the defect: with three DAC-capable stages (Eversolo
 * DMP-A6, Chord Hugo, JOB INTegrated's onboard conversion) the review
 * compared "Eversolo conversion vs JOB onboard conversion", silently
 * dropping the explicitly supplied Hugo and asserting a path the listener
 * never stated. These pins hold the repaired behavior: ambiguity is
 * preserved and asked about when material, resolved silently when the
 * listener states the path, and never manufactured for ordinary systems.
 */
import { describe, it, expect } from 'vitest';
import { analyzeConversionPath } from '../../assessment/conversion-path';
import { composeSystemReviewDetailed } from '../system-review';
import { interfaceConclusions } from '../interface-conclusions';
import type { DossierView } from '@/lib/evidence/dossier-presentation';

const dossier = (displayName: string, lines: Array<[string, string]>): DossierView => ({
  displayName,
  role: '',
  primary: lines.map(([label, value]) => ({
    label, value, provenance: 'maker_published', source: 'maker',
  })),
  secondary: [],
  gaps: [],
} as unknown as DossierView);

// France II: three DAC-capable stages, no stated connections.
const FRANCE_II = [
  { displayName: 'Eversolo DMP-A6', role: 'streamer' },
  { displayName: 'Chord Hugo', role: 'dac' },
  { displayName: 'Job integrated', role: 'amplifier' },
  { displayName: 'WLM Diva monitor', role: 'speaker' },
];
const JOB_DAC_DOSSIER = dossier('Job integrated', [
  ['Architecture', 'integrated amplifier with onboard D/A conversion and digital inputs'],
]);
const EVERSOLO_DAC_DOSSIER = dossier('Eversolo DMP-A6', [
  ['Architecture', 'streamer with onboard DAC, ES9038Q2M conversion'],
]);

describe('analyzeConversionPath — ambiguity detection', () => {
  it('FRANCE II: dedicated DAC + converting amplifier is ambiguous, and every stage is represented', () => {
    const a = analyzeConversionPath(
      FRANCE_II,
      [JOB_DAC_DOSSIER, EVERSOLO_DAC_DOSSIER],
      'Assess my system: - JOB INTegrated - WLM Diva Monitor - Eversolo DMP-A6 - Chord Hugo',
    );
    expect(a.ambiguous).toBe(true);
    // The Hugo must not disappear from conversion reasoning.
    const names = a.stages.map((s) => s.name);
    expect(names).toContain('Chord Hugo');
    expect(names).toContain('Job integrated');
    expect(names).toContain('Eversolo DMP-A6');
  });

  it('explicit stated path resolves ambiguity without a question', () => {
    const a = analyzeConversionPath(
      FRANCE_II,
      [JOB_DAC_DOSSIER],
      'Eversolo digital out → Chord Hugo → JOB analogue input → WLM Diva',
    );
    expect(a.explicit).toBe(true);
    expect(a.ambiguous).toBe(false);
  });

  it('an excluded component ("Hugo isn\'t being used") leaves conversion reasoning', () => {
    const a = analyzeConversionPath(
      FRANCE_II,
      [JOB_DAC_DOSSIER],
      "Eversolo analogue out into the JOB, then the WLM Diva. The Hugo isn't being used.",
    );
    expect(a.excluded).toContain('Chord Hugo');
    expect(a.stages.map((s) => s.name)).not.toContain('Chord Hugo');
    expect(a.ambiguous).toBe(false);
  });

  it('SIMPLE SYSTEM: streamer into analogue integrated stays frictionless', () => {
    const a = analyzeConversionPath(
      [
        { displayName: 'WiiM Pro', role: 'streamer' },
        { displayName: 'Yamaha A-S501', role: 'amplifier' },
        { displayName: 'KEF Q3 Meta', role: 'speaker' },
      ],
      [],
      'Assess my system: WiiM Pro, Yamaha A-S501, KEF Q3 Meta',
    );
    expect(a.ambiguous).toBe(false);
  });

  it('streamer into dedicated DAC into ANALOGUE amplifier has one natural reading', () => {
    const a = analyzeConversionPath(
      [
        { displayName: 'WiiM Pro', role: 'streamer' },
        { displayName: 'Chord Qutest', role: 'dac' },
        { displayName: 'Yamaha A-S501', role: 'amplifier' },
        { displayName: 'KEF Q3 Meta', role: 'speaker' },
      ],
      [],
      undefined,
    );
    expect(a.ambiguous).toBe(false);
  });

  it('dedicated DAC alongside an integrated with its own DAC preserves ambiguity', () => {
    const a = analyzeConversionPath(
      [
        { displayName: 'WiiM Pro', role: 'streamer' },
        { displayName: 'Chord Qutest', role: 'dac' },
        { displayName: 'NAD C 3050', role: 'integrated' },
        { displayName: 'Wharfedale Linton', role: 'speaker' },
      ],
      [dossier('NAD C 3050', [['Architecture', 'HybridDigital integrated with onboard DAC and digital inputs']])],
      undefined,
    );
    expect(a.ambiguous).toBe(true);
  });

  it('two dedicated DACs are ambiguous even without a converting amplifier', () => {
    const a = analyzeConversionPath(
      [
        { displayName: 'Chord Hugo', role: 'dac' },
        { displayName: 'Chord Qutest', role: 'dac' },
        { displayName: 'Yamaha A-S501', role: 'amplifier' },
      ],
      [],
      undefined,
    );
    expect(a.ambiguous).toBe(true);
  });

  it('SUBWOOFER control: source → integrated → passives + powered sub is not interrogated', () => {
    const a = analyzeConversionPath(
      [
        { displayName: 'Eversolo DMP-A6 Gen 2', role: 'streamer_dac' },
        { displayName: 'Hegel H150', role: 'amplifier' },
        { displayName: 'KEF LS50 Meta', role: 'speaker' },
        { displayName: 'SVS SB-1000 Pro', role: 'subwoofer' },
      ],
      [],
      'Assess my system: Eversolo DMP-A6 Gen 2 streamer, Hegel H150 amplifier, KEF LS50 Meta speakers, SVS SB-1000 Pro subwoofer',
    );
    expect(a.ambiguous).toBe(false);
  });
});

describe('composeSystemReviewDetailed — review-level behavior', () => {
  it('FRANCE II: no pairwise conversion comparison; ambiguity preserved with one question naming the Hugo', () => {
    const detail = composeSystemReviewDetailed({
      components: FRANCE_II,
      dossiers: [JOB_DAC_DOSSIER, EVERSOLO_DAC_DOSSIER],
      rawQuery: 'Assess my system: - JOB INTegrated - WLM Diva Monitor - Eversolo DMP-A6 - Chord Hugo',
    });
    const all = detail.paragraphs.join('\n');
    expect(all).not.toContain('contains two conversion stages');
    const ambiguityPara = detail.paragraphs.find((p) => /how are you connecting them\?/.test(p));
    expect(ambiguityPara).toBeTruthy();
    expect(ambiguityPara).toContain('Chord Hugo');
  });

  it('explicit path: no clarification question is asked', () => {
    const detail = composeSystemReviewDetailed({
      components: FRANCE_II,
      dossiers: [JOB_DAC_DOSSIER, EVERSOLO_DAC_DOSSIER],
      rawQuery: 'Eversolo digital out → Chord Hugo → JOB analogue input → WLM Diva',
    });
    expect(detail.paragraphs.join('\n')).not.toContain('how are you connecting them?');
  });

  it('excluded Hugo: no clarification, and the Hugo does not drive conversion advice', () => {
    const detail = composeSystemReviewDetailed({
      components: FRANCE_II,
      dossiers: [JOB_DAC_DOSSIER, EVERSOLO_DAC_DOSSIER],
      rawQuery: "Eversolo analogue out into the JOB, then the WLM Diva. The Hugo isn't being used.",
    });
    const all = detail.paragraphs.join('\n');
    expect(all).not.toContain('how are you connecting them?');
  });

  it('PROTECTED: the two-stage free experiment still fires with no dedicated DAC in the chain', () => {
    const detail = composeSystemReviewDetailed({
      components: [
        { displayName: 'Eversolo DMP-A6', role: 'streamer_dac' },
        { displayName: 'NAD C 3050', role: 'integrated' },
        { displayName: 'Wharfedale Linton', role: 'speaker' },
      ],
      dossiers: [dossier('NAD C 3050', [['Architecture', 'HybridDigital integrated with onboard DAC and digital inputs']])],
      rawQuery: 'Assess my system: Eversolo DMP-A6, NAD C 3050, Wharfedale Linton',
    });
    const all = detail.paragraphs.join('\n');
    expect(all).toContain('contains two conversion stages');
    expect(all).not.toContain('how are you connecting them?');
  });

  it('simple system: no conversion interrogation appears at all', () => {
    const detail = composeSystemReviewDetailed({
      components: [
        { displayName: 'WiiM Pro', role: 'streamer' },
        { displayName: 'Yamaha A-S501', role: 'amplifier' },
        { displayName: 'KEF Q3 Meta', role: 'speaker' },
      ],
      dossiers: [],
      rawQuery: 'Assess my system: WiiM Pro, Yamaha A-S501, KEF Q3 Meta',
    });
    expect(detail.paragraphs.join('\n')).not.toContain('how are you connecting them?');
  });
});

describe('interfaceConclusions — no interfaces over an unestablished path', () => {
  const IMPEDANCE_DOSSIERS = [
    dossier('Eversolo DMP-A6', [['Output impedance', '100 ohms']]),
    dossier('ARC Reference 5', [['Input impedance', '600 ohms balanced']]),
  ];
  const WITH_PREAMP = [
    { displayName: 'Eversolo DMP-A6', role: 'streamer' },
    { displayName: 'Chord Hugo', role: 'dac' },
    { displayName: 'ARC Reference 5', role: 'preamplifier' },
    { displayName: 'Job integrated', role: 'amplifier' },
  ];

  it('with an ambiguous conversion path, no source-adjacent interface is composed', () => {
    const cs = interfaceConclusions(WITH_PREAMP, IMPEDANCE_DOSSIERS, {
      conversionPathAmbiguous: true,
    });
    expect(cs.every((c) => c.upstream !== 'Eversolo DMP-A6' && c.upstream !== 'Chord Hugo')).toBe(true);
  });

  it('without ambiguity the source interface still composes (control)', () => {
    const cs = interfaceConclusions(WITH_PREAMP, IMPEDANCE_DOSSIERS);
    expect(cs.some((c) => c.upstream === 'Eversolo DMP-A6')).toBe(true);
  });
});
