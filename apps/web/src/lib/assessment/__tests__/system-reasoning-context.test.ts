/**
 * ONE system reasoning context — convergence pins (2026-09-12).
 *
 * The deterministic system computations (conversion path, interface
 * conclusions, decision gaps) have exactly one owner, and both consumers —
 * the review composer and the provisional model prompt — read it. Canonical
 * and provisional differ in what the substrate CONTAINS, never in which
 * computations exist. These pins protect:
 *
 *   - the serialized context states facts and refusals, never sonic
 *     character;
 *   - decision-relevant unknowns reach the model prompt for ANY component,
 *     catalogued or not;
 *   - the evidence loop is lane-independent: adding one decision-relevant
 *     maker figure narrows the SAME composition for a provisional-class
 *     system exactly as it did for the Boenicke control;
 *   - only calculation-grade authored facts cross into the model's
 *     evidence feed.
 */
import { describe, it, expect } from 'vitest';
import {
  buildSystemReasoningContext, serializeSystemReasoningContext,
} from '../system-reasoning-context';
import { composeSystemReviewDetailed } from '@/lib/artifact/system-review';
import { authoredEvidenceItems } from '@/lib/evidence/relationship-facts';
import { observationKeyFor } from '@/lib/reasoning/evidence-retrieval';
import { buildProvisionalPrompt } from '@/lib/llm-system-inference';
import type { DossierView } from '@/lib/evidence/dossier-presentation';

const dossier = (
  displayName: string,
  lines: Array<[string, string]>,
  typedGaps: Array<{ text: string; quantity?: string }> = [],
): DossierView => ({
  displayName, role: '', secondary: [], gaps: typedGaps.map((g) => g.text), typedGaps,
  primary: lines.map(([label, value]) => ({
    label, value, provenance: 'maker_published', source: 'maker',
  })),
} as unknown as DossierView);

const REAL_USER = [
  { displayName: 'Topping D70 Pro OCTO', role: 'dac' },
  { displayName: 'Nad AV716', role: 'integrated' },
  { displayName: 'Dynaco A35', role: 'speaker' },
];

describe('1 — the serialization is facts and refusals only', () => {
  const ds = [
    dossier('Chord Hugo', [['Architecture', 'portable DAC with analogue output']]),
    dossier('Job integrated', [['Architecture', 'integrated amplifier with onboard D/A conversion and digital inputs']]),
    dossier('Boenicke W5', [], [{
      text: 'an impedance/phase plot for the W5.', quantity: 'speaker_impedance_curve',
    }]),
  ];
  const ctx = buildSystemReasoningContext([
    { displayName: 'Eversolo DMP-A6', role: 'streamer' },
    { displayName: 'Chord Hugo', role: 'dac' },
    { displayName: 'Job integrated', role: 'amplifier' },
    { displayName: 'Boenicke W5', role: 'speaker' },
  ], ds, 'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, Boenicke W5');
  const s = serializeSystemReasoningContext(ctx);

  it('carries the unsettled-topology refusal', () => {
    expect(s).toMatch(/Conversion topology: UNSETTLED/);
    expect(s).toMatch(/Do not assume one/);
  });

  it('carries decision gaps with the no-substitution refusal', () => {
    expect(s).toMatch(/Unresolved and decision-relevant — Boenicke W5/);
    expect(s).toMatch(/Do not estimate or substitute this figure\./);
  });

  it('never speaks sonic character', () => {
    expect(s).not.toMatch(/warm|bright|airy|tonally|detailed|musical|smooth/i);
  });

  it('a stated path serializes as established, not as a question', () => {
    const explicit = buildSystemReasoningContext(
      ctx.conversion.stages.length
        ? [{ displayName: 'Chord Hugo', role: 'dac' }, { displayName: 'Job integrated', role: 'amplifier' }]
        : [],
      ds.slice(0, 2),
      'Eversolo digital out into the Chord Hugo, Hugo into the JOB analogue input',
    );
    expect(serializeSystemReasoningContext(explicit))
      .toMatch(/established from the listener’s own description/);
  });
});

describe('2 — the evidence loop is lane-independent', () => {
  it('a provisional-class system with no figures gets the same open-relationship state', () => {
    const d = composeSystemReviewDetailed({
      components: REAL_USER, dossiers: [],
      rawQuery: 'assess my system: NAD AV716 receiver, Topping D70 Pro OCTO DAC, Dynaco A35 speakers',
    });
    const fits = (d.sections ?? []).find((sec) => /fits together/i.test(sec.label))
      ?.paragraphs.join('\n') ?? '';
    expect(fits).toMatch(/not enough to say whether it is actually limiting/);
    expect(fits).toMatch(/Nad AV716’s rated output/);
  });

  it('ONE admitted maker figure narrows it — identically to the Boenicke pattern', () => {
    // Test fixture, not a product fact: the mechanism under test is that a
    // maker figure, once admitted to the shared record, narrows THIS lane's
    // composition with zero lane-specific code.
    const d = composeSystemReviewDetailed({
      components: REAL_USER,
      dossiers: [dossier('Dynaco A35', [
        ['sensitivity', '89dB/W/m'], ['nominal impedance', '8 ohms'],
      ])],
      rawQuery: 'assess my system: NAD AV716 receiver, Topping D70 Pro OCTO DAC, Dynaco A35 speakers',
    });
    const fits = (d.sections ?? []).find((sec) => /fits together/i.test(sec.label))
      ?.paragraphs.join('\n') ?? '';
    expect(fits).toMatch(/side of that question is on the record/);
    expect(fits).toMatch(/89dB\/W\/m/);
    expect(fits).toMatch(/8-ohm nominal load/);
    expect(fits).toMatch(/What still cannot be established is the Nad AV716’s rated output/);
  });

  it('the same gaps reach the model prompt for uncatalogued components', () => {
    const ds = [dossier('Nad AV716', [], [{
      text: 'NAD’s rated output for the AV716.', quantity: 'amplifier_rated_output',
    }])];
    const ctx = buildSystemReasoningContext(REAL_USER, ds,
      'assess my system: NAD AV716 receiver, Topping D70 Pro OCTO DAC, Dynaco A35 speakers');
    const p = buildProvisionalPrompt(
      'assess my system', REAL_USER.map((c) => c.displayName), [], [], [], [],
      [], {}, REAL_USER.map((c) => ({ name: c.displayName, role: c.role })),
      serializeSystemReasoningContext(ctx));
    expect(p.userPrompt).toMatch(/SYSTEM FACTS ESTABLISHED BY AUDIO XX/);
    expect(p.userPrompt).toMatch(/Unresolved and decision-relevant — Nad AV716/);
  });
});

describe('3 — only calculation-grade authored facts cross to the model feed', () => {
  const items = authoredEvidenceItems(
    ['Boenicke W5', 'Eversolo DMP-A6', 'JOB Integrated'], observationKeyFor);

  it('the W5 maker figures cross, with normalized fields and attribution', () => {
    const sens = items.find((i) => i.field === 'sensitivity');
    const imp = items.find((i) => i.field === 'nominal_impedance');
    expect(sens?.value).toMatch(/83–86dB/);
    expect(imp?.value).toBe('4 ohms');
    for (const i of [sens, imp]) {
      expect(i?.evidenceClass).toBe('manufacturer');
      expect(i?.attribution?.sourceUrl).toMatch(/boenicke-audio\.ch/);
      expect(i?.attribution?.quotedText).toBeTruthy();
    }
  });

  it('reported (non-calculable) facts do not cross', () => {
    // The Eversolo line-output figure is third_party_reported; the JOB 225
    // family figures are architecture facts. Neither may feed arithmetic.
    expect(items.some((i) => i.productKey.includes('eversolo'))).toBe(false);
    expect(items.some((i) => /125W/.test(i.value))).toBe(false);
  });
});
