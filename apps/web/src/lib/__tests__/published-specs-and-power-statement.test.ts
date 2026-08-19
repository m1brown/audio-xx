import { describe, it, expect } from 'vitest';
import { buildSystemAssessment } from '../consultation';
import { extractSubjectMatches } from '../intent';
import { buildProvisionalPrompt } from '../llm-system-inference';
import { classifyPowerMatch, powerMatchStatement } from '../power-match';
import { toEvidenceItem } from '../evidence/manufacturer-facts';
import { parseLabelledComponents } from '../labelled-components';
import type { EvidenceItem } from '../evidence/evidence-types';

const fact = (product: string, field: string, value: string, host: string): EvidenceItem =>
  toEvidenceItem(product, {
    field: field as never, value,
    sourceUrl: `https://${host}/products/x`, quotedText: value,
  }, Date.now());

/**
 * Phase 1 — making acquired manufacturer evidence actually reach the listener.
 *
 * Three consumers, each for evidence we already held and could not use.
 */

describe('published specifications describe a component we cannot characterise', () => {
  const text = 'Assess my system: Amp: Decware SE84UFO Speakers: Acora QRC-2 '
    + 'Dac: Denafrips Pontus II';
  const specs = [
    fact('Acora QRC-2', 'sensitivity', '84 dB', 'acoraaudio.com'),
    fact('Acora QRC-2', 'impedance', '8 ohms', 'acoraaudio.com'),
  ];
  const logic = (ev: EvidenceItem[]) => {
    const r = buildSystemAssessment(
      text, extractSubjectMatches(text), undefined, undefined, undefined, ev,
    ) as { response?: { systemContext?: string } };
    return (r?.response?.systemContext ?? '')
      .match(/\*\*System logic\*\*[\s\S]*?(?=\n\*\*)/)?.[0] ?? '';
  };

  it('says nothing about an uncatalogued component when we hold nothing', () => {
    expect(logic([])).toMatch(/Acora QRC-2 → not identified — no sonic character claimed/);
  });

  it('states the maker’s published figures when we hold them', () => {
    const out = logic(specs);
    expect(out).toMatch(/Acora QRC-2 → not in the catalogue — the maker publishes/);
    expect(out).toMatch(/84 dB sensitivity and 8 Ω nominal/);
  });

  it('still claims no sonic character for it', () => {
    // A published specification says what the thing IS. It licenses nothing
    // about how it sounds, and the row must not acquire a tonal reading.
    const out = logic(specs);
    expect(out).not.toMatch(/Acora QRC-2 → .*(?:warm|bright|smooth|resolving|tone-rich)/);
  });
});

describe('the physical relation is computed once, for both paths', () => {
  it('the classifier is shared, not duplicated', () => {
    expect(classifyPowerMatch(100, 86).estimatedMaxCleanSPL).toBeCloseTo(106, 5);
    expect(classifyPowerMatch(100, 86).compatibility).toBe('optimal');
    expect(classifyPowerMatch(2, 84).compatibility).toBe('mismatched');
  });

  it('says nothing at all when the pairing is unassessable', () => {
    expect(powerMatchStatement('A', 'B', null, 86)).toBeNull();
    expect(powerMatchStatement('A', 'B', 100, null)).toBeNull();
  });

  it('the provisional prompt carries the computed figure, not raw numbers alone', () => {
    const names = ['dCS Rossini Apex', 'Audio Research Reference 5',
      'Butler MONAD A100', 'Acora QRC-2'];
    const { userPrompt } = buildProvisionalPrompt(
      'Assess my system', names, [], [], names, [],
      [fact('Butler MONAD A100', 'power_output', '100 Watts RMS @ 8 Ohms', 'butleraudio.com'),
       fact('Acora QRC-2', 'sensitivity', '86 dB', 'acoraaudio.com')],
    );
    expect(userPrompt).toMatch(/POWER MATCH/);
    expect(userPrompt).toMatch(/estimated 106 dB maximum clean output/);
    expect(userPrompt).toMatch(/do NOT recompute it/);
  });

  it('emits no power-match block when only one side published a figure', () => {
    const { userPrompt } = buildProvisionalPrompt(
      'Assess my system', ['Butler MONAD A100', 'Acora QRC-2'], [], [],
      ['Butler MONAD A100', 'Acora QRC-2'], [],
      [fact('Butler MONAD A100', 'power_output', '100 Watts RMS @ 8 Ohms', 'butleraudio.com')],
    );
    expect(userPrompt).not.toMatch(/POWER MATCH/);
  });
});

describe('a preamplifier labelled "Pre" is a preamplifier', () => {
  // "Pre" alone required "amp" to follow, so an ARC Reference 5 behind a
  // `Pre:` label resolved as an AMPLIFIER and collided with the power amp —
  // a textbook separates system stopped to ask which had replaced the other.
  const roleOf = (label: string) =>
    parseLabelledComponents(`Dac: dCS Rossini Apex ${label}: Audio Research Reference 5 `
      + `Amp: Butler MONAD A100 Speakers: Acora QRC-2`)
      .find((c) => /Reference 5/i.test(c.rawName))?.roles[0];

  it.each(['Pre', 'Preamp', 'Preamplifier', 'Pre-amp'])('%s → preamplifier', (label) => {
    expect(roleOf(label)).toBe('preamplifier');
  });

  it('does not steal the power amplifier’s label', () => {
    const parsed = parseLabelledComponents(
      'Pre: Audio Research Reference 5 Power amp: Butler MONAD A100',
    );
    expect(parsed.find((c) => /Butler/i.test(c.rawName))?.roles[0]).toBe('amplifier');
  });
});
