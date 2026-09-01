import { describe, it, expect } from 'vitest';
import { deriveEvidenceLedger } from '../evidence-ledger';
import { synthesiseChain } from '../sonic-synthesis';
import type { DossierView } from '@/lib/evidence/dossier-presentation';

/**
 * NO PARALLEL REVIEW BIBLIOGRAPHY.
 *
 * The rendered review quoted The Absolute Sound on the ARC and Stereophile and
 * SoundStage! on the Acora, and EVIDENCE named none of them — the ledger read
 * dossier lines only, and review-derived character does not travel as one. A
 * reader checking what the assessment rested on was handed a bibliography
 * missing the sources of its strongest claims.
 */

const NATHAN = [
  { displayName: 'dCS Rossini Apex', role: 'dac' },
  { displayName: 'ARC ref 5', role: 'preamplifier' },
  { displayName: 'Butler Monads', role: 'amplifier' },
  { displayName: 'Acora QRC-2', role: 'speaker' },
];

const dossiers = NATHAN.map((c) => ({
  displayName: c.displayName, role: c.role, primary: [], secondary: [],
})) as unknown as DossierView[];

const ledger = () => deriveEvidenceLedger(dossiers, synthesiseChain(NATHAN));

describe('every surviving review source reaches EVIDENCE', () => {
  it('names all three publications the review actually used', () => {
    const labels = ledger().entries.map((e) => e.label);
    for (const p of ['Stereophile', 'The Absolute Sound', 'SoundStage!']) {
      expect(labels, p).toContain(p);
    }
  });

  it('scopes each publication to the components it spoke about', () => {
    const bySource = new Map(ledger().entries.map((e) => [e.label, e.licensedFor]));
    // TAS reviewed the Reference 5 and nothing else in this chain.
    expect(bySource.get('The Absolute Sound')).toEqual(['ARC ref 5']);
    // SoundStage!'s only observation here is the QRC-2 comparison.
    expect(bySource.get('SoundStage!')).toEqual(['Acora QRC-2']);
  });

  it('scopes the Butler evidence to the Butler, and only there', () => {
    /*
     * This used to assert that NO source scoped to the Butler, because it had
     * none. The Audio Beatnik's A100 review is now admitted and the
     * sole-model plural alias resolves "Butler Monads" to it, so the correct
     * assertion is the scoping one: the Beatnik licensed the amplifier and
     * nothing else in this chain.
     */
    const beatnik = ledger().entries.find((e) => e.label === 'The Audio Beatnik');
    expect(beatnik?.licensedFor).toEqual(['Butler Monads']);
    for (const e of ledger().entries) {
      if (e.label === 'The Audio Beatnik') continue;
      expect(e.licensedFor, e.label).not.toContain('Butler Monads');
    }
  });

  it('every scoped component is one the document actually renders', () => {
    const rendered = new Set(dossiers.map((d) => d.displayName));
    for (const e of ledger().entries) {
      for (const name of e.licensedFor) expect(rendered.has(name), name).toBe(true);
    }
  });

  it('lists ONLY sources whose evidence survived into the document', () => {
    /*
     * Stereophile's measurements of the Rossini Apex are admitted evidence and
     * are deliberately absent here: a measurement never becomes a character
     * proposition, so nothing derived from it reaches the review or the
     * dossier. The ledger describes what the assessment rests on, not
     * everything Audio XX holds — an inventory would be the parallel
     * bibliography this exists to prevent.
     */
    const measurementUrls = ledger().entries
      .filter((e) => e.url?.includes('measurements'));
    expect(measurementUrls).toEqual([]);
  });

  it('separates measurement from listening when a measurement DOES survive', () => {
    const withMeasurement = deriveEvidenceLedger(dossiers, {
      character: new Map([['dCS Rossini Apex', [{
        publications: ['Stereophile'],
        support: [{
          publication: 'Stereophile',
          sourceUrl: 'https://www.stereophile.com/x-measurements',
          observationType: 'measurement',
        }],
      }]]]),
    });
    const entry = withMeasurement.entries.find((e) => e.label === 'Stereophile');
    expect(entry?.evidenceClass).toBe('independent_measurement');
  });

  it('the statement admits what kinds of evidence are present', () => {
    expect(ledger().statement).toMatch(/listening observations|independent measurements/);
  });

  it('a system with no review evidence gets no review entries', () => {
    const none = deriveEvidenceLedger(
      [{ displayName: 'Unknown Thing', role: 'dac', primary: [], secondary: [] }] as unknown as DossierView[],
      synthesiseChain([{ displayName: 'Unknown Thing', role: 'dac' }]),
    );
    expect(none.entries.filter((e) => e.evidenceClass === 'independent_review')).toEqual([]);
  });
});
