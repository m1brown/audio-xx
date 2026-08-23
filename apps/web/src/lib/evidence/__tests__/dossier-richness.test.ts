import { describe, it, expect } from 'vitest';
import { dossierFor } from '../product-dossier';
import { presentDossier, worthRendering } from '../dossier-presentation';

/**
 * Richness must track KNOWLEDGE HELD, not which bucket a field lands in.
 *
 * On Nathan the dCS Rossini Apex held three manufacturer specs and three
 * admitted Stereophile observations, and the Audio Research Reference 5 held
 * four specs including its tube complement. Both rendered NOTHING, because the
 * card was gated on the primary bucket being non-empty.
 */

const specs = (rows: Array<[string, string]>) =>
  rows.map(([field, value]) => ({ field, value }));

const ARC = () => presentDossier(dossierFor('arc ref 5', 'ARC ref 5', {
  role: 'preamplifier',
  heldSpecs: specs([
    ['frequency_response', '0.5Hz to 200kHz'],
    ['inputs', 'CD, TUNER, VIDEO, PHONO, AUX 1, AUX 2, PROCESSOR'],
    ['tube_complement', '(4)-6H30P dual triodes, plus (1 each) 6550C and 6H30P in power supply'],
    ['weight', '30.4 lbs. (13.9 kg) Net'],
  ]),
}));

const DCS = () => presentDossier(dossierFor('dcs rossini apex', 'dCS Rossini Apex', {
  role: 'dac',
  heldSpecs: specs([['dimensions', '444mm x 435mm x 151mm'], ['weight', '17.4kg']]),
  reviews: [
    { publication: 'Stereophile', claim: 'Measured performance was beyond reproach.',
      sourceUrl: 'https://www.stereophile.com/content/dcs-rossini-apex' },
    { publication: 'Stereophile', claim: 'Sounded smoother than the earlier Rossini.',
      condition: { kind: 'other', description: 'direct A/B against the earlier Rossini' } },
    { publication: 'Stereophile', claim: 'Felt more controlled over Ethernet.',
      condition: { kind: 'associated_equipment', description: 'Ethernet input rather than USB' } },
  ],
}));

describe('a component with only detail-level knowledge still renders', () => {
  it('ARC renders, and its tube architecture is reachable', () => {
    const v = ARC();
    expect(worthRendering(v)).toBe(true);
    expect(v.hasDetail).toBe(true);
    expect(v.detailSummary).toMatch(/4 published details held/);
    const tubes = v.secondary.find((l) => l.label === 'tube complement');
    expect(tubes?.value).toContain('6H30P');
  });

  it('does NOT promote detail facts to the main surface', () => {
    // The fix is a render gate, not bucket promotion.
    expect(ARC().primary).toEqual([]);
  });

  it('shipping data alone is not knowledge worth a card', () => {
    const v = presentDossier(dossierFor('x', 'X', {
      role: 'dac', heldSpecs: specs([['dimensions', '1x1x1'], ['weight', '2kg']]),
    }));
    expect(worthRendering(v)).toBe(false);
  });

  it('a component Audio XX knows nothing about renders nothing', () => {
    expect(worthRendering(presentDossier(dossierFor('y', 'Y')))).toBe(false);
  });
});

describe('review coverage is exposed without becoming a conclusion', () => {
  const v = DCS();

  it('names the publications as held coverage', () => {
    expect(worthRendering(v)).toBe(true);
    const cov = v.primary.find((l) => l.label === 'Independent review');
    expect(cov?.value).toBe('Stereophile');
  });

  it('keeps each observation behind detail, with its publication', () => {
    const obs = v.secondary.filter((l) => l.publication === 'Stereophile');
    expect(obs).toHaveLength(3);
  });

  it('PRESERVES the material condition — never flattened', () => {
    const conditioned = v.secondary.find((l) => l.value.includes('smoother'));
    expect(conditioned?.value).toContain('only direct A/B against the earlier Rossini');
  });

  it('PRESERVES the transfer limitation', () => {
    const transfer = v.secondary.find((l) => l.value.includes('controlled'));
    expect(transfer?.value).toContain('heard through other electronics');
  });

  it('states coverage as coverage, never as a system claim', () => {
    const cov = v.primary.find((l) => l.label === 'Independent review')!;
    // A publication list. No verdict, no adjective, no system.
    expect(cov.value).not.toMatch(/system|sounds|character|smooth|detailed|warm/i);
  });
});
